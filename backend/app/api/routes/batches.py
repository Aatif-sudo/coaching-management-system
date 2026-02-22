from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.models.batch import Batch, StudentBatch
from app.models.enums import UserRole
from app.models.student import Student
from app.models.user import User
from app.schemas.batch import BatchCreate, BatchResponse, BatchStudentResponse, BatchUpdate
from app.schemas.common import PaginatedResponse

router = APIRouter()


@router.post("/", response_model=BatchResponse, status_code=status.HTTP_201_CREATED)
def create_batch(
    payload: BatchCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.TEACHER)),
) -> Batch:
    batch = Batch(
        institute_id=current_user.institute_id,
        name=payload.name,
        course=payload.course,
        schedule=payload.schedule,
        teacher_id=payload.teacher_id,
        start_date=payload.start_date,
        end_date=payload.end_date,
        fee_plan_id=payload.fee_plan_id,
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)
    return batch


@router.get("/", response_model=PaginatedResponse)
def list_batches(
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PaginatedResponse:
    stmt = select(Batch).where(Batch.institute_id == current_user.institute_id)
    if current_user.role == UserRole.STUDENT:
        if not current_user.student_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Student profile not linked")
        stmt = stmt.join(StudentBatch, StudentBatch.batch_id == Batch.id).where(
            StudentBatch.student_id == current_user.student_id
        )

    if search:
        stmt = stmt.where(Batch.name.ilike(f"%{search}%"))

    stmt = stmt.distinct()
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = list(
        db.scalars(
            stmt.order_by(Batch.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
        )
    )
    return PaginatedResponse(
        total=total,
        page=page,
        page_size=page_size,
        items=[BatchResponse.model_validate(item).model_dump(mode="json") for item in rows],
    )


@router.get("/{batch_id}", response_model=BatchResponse)
def get_batch(
    batch_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Batch:
    stmt = select(Batch).where(Batch.id == batch_id, Batch.institute_id == current_user.institute_id)
    if current_user.role == UserRole.STUDENT:
        if not current_user.student_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Student profile not linked")
        stmt = stmt.join(StudentBatch, StudentBatch.batch_id == Batch.id).where(
            StudentBatch.student_id == current_user.student_id
        )
    batch = db.scalar(stmt)
    if not batch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Batch not found")
    return batch


@router.patch("/{batch_id}", response_model=BatchResponse)
def update_batch(
    batch_id: int,
    payload: BatchUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.TEACHER)),
) -> Batch:
    batch = db.scalar(select(Batch).where(Batch.id == batch_id, Batch.institute_id == current_user.institute_id))
    if not batch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Batch not found")
    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(batch, key, value)
    db.commit()
    db.refresh(batch)
    return batch


@router.delete("/{batch_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_batch(
    batch_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
) -> None:
    batch = db.scalar(select(Batch).where(Batch.id == batch_id, Batch.institute_id == current_user.institute_id))
    if not batch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Batch not found")
    db.delete(batch)
    db.commit()
    return None


@router.get("/{batch_id}/students", response_model=list[BatchStudentResponse])
def list_batch_students(
    batch_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[BatchStudentResponse]:
    batch = db.scalar(select(Batch).where(Batch.id == batch_id, Batch.institute_id == current_user.institute_id))
    if not batch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Batch not found")

    stmt = (
        select(Student)
        .join(StudentBatch, StudentBatch.student_id == Student.id)
        .where(StudentBatch.batch_id == batch_id, Student.institute_id == current_user.institute_id)
        .order_by(Student.full_name.asc())
    )
    students = list(db.scalars(stmt))
    return [
        BatchStudentResponse(id=s.id, full_name=s.full_name, phone=s.phone, email=s.email)
        for s in students
    ]


@router.get("/{batch_id}/schedule")
def batch_schedule(
    batch_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    batch = db.scalar(
        select(Batch)
        .options(selectinload(Batch.teacher))
        .where(Batch.id == batch_id, Batch.institute_id == current_user.institute_id)
    )
    if not batch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Batch not found")
    if current_user.role == UserRole.STUDENT:
        link = db.scalar(
            select(StudentBatch).where(
                StudentBatch.batch_id == batch.id,
                StudentBatch.student_id == current_user.student_id,
            )
        )
        if not link:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
    return {
        "batch_id": batch.id,
        "name": batch.name,
        "course": batch.course,
        "schedule": batch.schedule,
        "teacher_name": batch.teacher.full_name if batch.teacher else None,
        "start_date": batch.start_date,
        "end_date": batch.end_date,
    }
