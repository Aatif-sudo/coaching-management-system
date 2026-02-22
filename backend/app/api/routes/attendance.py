import csv
from io import StringIO

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.core.audit import create_audit_log
from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.models.attendance import Attendance
from app.models.batch import Batch, StudentBatch
from app.models.enums import AttendanceStatus, UserRole
from app.models.user import User
from app.schemas.attendance import AttendanceMarkRequest, AttendanceResponse, AttendanceStatsResponse
from app.schemas.common import PaginatedResponse

router = APIRouter()


@router.post("/mark", response_model=list[AttendanceResponse])
def mark_attendance(
    payload: AttendanceMarkRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.TEACHER)),
) -> list[Attendance]:
    batch = db.scalar(
        select(Batch).where(Batch.id == payload.batch_id, Batch.institute_id == current_user.institute_id)
    )
    if not batch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Batch not found")

    enrolled_student_ids = set(
        db.scalars(
            select(StudentBatch.student_id).where(
                StudentBatch.batch_id == payload.batch_id,
                StudentBatch.institute_id == current_user.institute_id,
            )
        )
    )
    incoming_student_ids = {item.student_id for item in payload.records}
    if not incoming_student_ids.issubset(enrolled_student_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Attendance records include students not enrolled in this batch",
        )

    existing_rows = list(
        db.scalars(
            select(Attendance).where(
                Attendance.institute_id == current_user.institute_id,
                Attendance.batch_id == payload.batch_id,
                Attendance.date == payload.date,
                Attendance.student_id.in_(incoming_student_ids),
            )
        )
    )
    existing_map = {row.student_id: row for row in existing_rows}

    result_rows: list[Attendance] = []
    for record in payload.records:
        existing = existing_map.get(record.student_id)
        if existing:
            before = {"status": existing.status.value}
            existing.status = record.status
            existing.marked_by = current_user.id
            after = {"status": existing.status.value}
            create_audit_log(
                db=db,
                institute_id=current_user.institute_id,
                actor_user_id=current_user.id,
                action="ATTENDANCE_UPDATED",
                entity="attendance",
                entity_id=str(existing.id),
                before=before,
                after=after,
            )
            result_rows.append(existing)
        else:
            attendance = Attendance(
                institute_id=current_user.institute_id,
                batch_id=payload.batch_id,
                student_id=record.student_id,
                date=payload.date,
                status=record.status,
                marked_by=current_user.id,
            )
            db.add(attendance)
            db.flush()
            create_audit_log(
                db=db,
                institute_id=current_user.institute_id,
                actor_user_id=current_user.id,
                action="ATTENDANCE_CREATED",
                entity="attendance",
                entity_id=str(attendance.id),
                before=None,
                after={"status": attendance.status.value},
            )
            result_rows.append(attendance)

    db.commit()
    for row in result_rows:
        db.refresh(row)
    return result_rows


@router.get("/history", response_model=PaginatedResponse)
def attendance_history(
    batch_id: int | None = Query(default=None),
    student_id: int | None = Query(default=None),
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PaginatedResponse:
    stmt = select(Attendance).where(Attendance.institute_id == current_user.institute_id)
    if batch_id:
        stmt = stmt.where(Attendance.batch_id == batch_id)
    if student_id:
        stmt = stmt.where(Attendance.student_id == student_id)
    if date_from:
        stmt = stmt.where(Attendance.date >= date_from)
    if date_to:
        stmt = stmt.where(Attendance.date <= date_to)

    if current_user.role == UserRole.STUDENT:
        if not current_user.student_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Student profile missing")
        stmt = stmt.where(Attendance.student_id == current_user.student_id)

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = list(
        db.scalars(
            stmt.order_by(Attendance.date.desc(), Attendance.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    )
    return PaginatedResponse(
        total=total,
        page=page,
        page_size=page_size,
        items=[AttendanceResponse.model_validate(item).model_dump(mode="json") for item in rows],
    )


@router.get("/stats", response_model=list[AttendanceStatsResponse])
def attendance_stats(
    batch_id: int | None = Query(default=None),
    student_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[AttendanceStatsResponse]:
    stmt = (
        select(
            Attendance.student_id,
            Attendance.batch_id,
            func.count(Attendance.id).label("total_classes"),
            func.sum(case((Attendance.status == AttendanceStatus.PRESENT, 1), else_=0)).label("present_count"),
            func.sum(case((Attendance.status == AttendanceStatus.ABSENT, 1), else_=0)).label("absent_count"),
        )
        .where(Attendance.institute_id == current_user.institute_id)
        .group_by(Attendance.student_id, Attendance.batch_id)
    )

    if batch_id:
        stmt = stmt.where(Attendance.batch_id == batch_id)
    if student_id:
        stmt = stmt.where(Attendance.student_id == student_id)
    if current_user.role == UserRole.STUDENT:
        if not current_user.student_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Student profile missing")
        stmt = stmt.where(Attendance.student_id == current_user.student_id)

    rows = db.execute(stmt).all()
    result: list[AttendanceStatsResponse] = []
    for row in rows:
        total = int(row.total_classes)
        present = int(row.present_count or 0)
        absent = int(row.absent_count or 0)
        percentage = round((present / total) * 100, 2) if total > 0 else 0.0
        result.append(
            AttendanceStatsResponse(
                student_id=row.student_id,
                batch_id=row.batch_id,
                total_classes=total,
                present_count=present,
                absent_count=absent,
                attendance_percentage=percentage,
            )
        )
    return result


@router.get("/export")
def export_attendance_csv(
    batch_id: int | None = Query(default=None),
    student_id: int | None = Query(default=None),
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.TEACHER)),
) -> Response:
    stmt = select(Attendance).where(Attendance.institute_id == current_user.institute_id)
    if batch_id:
        stmt = stmt.where(Attendance.batch_id == batch_id)
    if student_id:
        stmt = stmt.where(Attendance.student_id == student_id)
    if date_from:
        stmt = stmt.where(Attendance.date >= date_from)
    if date_to:
        stmt = stmt.where(Attendance.date <= date_to)
    rows = list(db.scalars(stmt.order_by(Attendance.date.asc())))

    csv_buffer = StringIO()
    writer = csv.writer(csv_buffer)
    writer.writerow(["attendance_id", "batch_id", "student_id", "date", "status", "marked_by", "created_at"])
    for item in rows:
        writer.writerow(
            [
                item.id,
                item.batch_id,
                item.student_id,
                item.date.isoformat(),
                item.status.value,
                item.marked_by,
                item.created_at.isoformat(),
            ]
        )
    csv_buffer.seek(0)

    filename = "attendance_export.csv"
    return StreamingResponse(
        iter([csv_buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
