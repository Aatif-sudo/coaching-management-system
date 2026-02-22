from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.models.batch import Batch, StudentBatch
from app.models.enums import StudentStatus, UserRole
from app.models.fee import Payment, StudentFee
from app.models.student import Student
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.student import (
    StudentBatchAssignRequest,
    StudentCreate,
    StudentResponse,
    StudentUpdate,
)

router = APIRouter()


def _serialize_student(student: Student) -> StudentResponse:
    return StudentResponse(
        id=student.id,
        institute_id=student.institute_id,
        full_name=student.full_name,
        phone=student.phone,
        email=student.email,
        guardian_name=student.guardian_name,
        guardian_phone=student.guardian_phone,
        address=student.address,
        join_date=student.join_date,
        status=student.status,
        created_at=student.created_at,
        updated_at=student.updated_at,
        batch_ids=[link.batch_id for link in student.batch_links],
    )


def _validate_batch_ids(db: Session, institute_id: int, batch_ids: list[int]) -> list[int]:
    if not batch_ids:
        return []
    unique_batch_ids = sorted(set(batch_ids))
    valid_ids = list(
        db.scalars(
            select(Batch.id).where(
                Batch.institute_id == institute_id,
                Batch.id.in_(unique_batch_ids),
            )
        )
    )
    if len(valid_ids) != len(unique_batch_ids):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="One or more batches are invalid")
    return valid_ids


def _replace_student_batches(db: Session, institute_id: int, student_id: int, batch_ids: list[int]) -> None:
    db.query(StudentBatch).filter(
        StudentBatch.institute_id == institute_id,
        StudentBatch.student_id == student_id,
    ).delete(synchronize_session=False)
    for batch_id in batch_ids:
        db.add(
            StudentBatch(
                institute_id=institute_id,
                student_id=student_id,
                batch_id=batch_id,
            )
        )


@router.post("/", response_model=StudentResponse, status_code=status.HTTP_201_CREATED)
def create_student(
    payload: StudentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.TEACHER)),
) -> StudentResponse:
    valid_batch_ids = _validate_batch_ids(db, current_user.institute_id, payload.batch_ids)
    student = Student(
        institute_id=current_user.institute_id,
        full_name=payload.full_name,
        phone=payload.phone,
        email=payload.email,
        guardian_name=payload.guardian_name,
        guardian_phone=payload.guardian_phone,
        address=payload.address,
        join_date=payload.join_date,
        status=payload.status,
    )
    db.add(student)
    db.flush()
    _replace_student_batches(db, current_user.institute_id, student.id, valid_batch_ids)
    db.commit()
    db.refresh(student)
    student = db.scalar(
        select(Student)
        .options(selectinload(Student.batch_links))
        .where(Student.id == student.id, Student.institute_id == current_user.institute_id)
    )
    return _serialize_student(student)


@router.get("/", response_model=PaginatedResponse)
def list_students(
    search: str | None = Query(default=None),
    phone: str | None = Query(default=None),
    batch_id: int | None = Query(default=None),
    unpaid_only: bool = Query(default=False),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.TEACHER)),
) -> PaginatedResponse:
    stmt = (
        select(Student)
        .options(selectinload(Student.batch_links))
        .where(Student.institute_id == current_user.institute_id)
    )

    if search:
        stmt = stmt.where(Student.full_name.ilike(f"%{search}%"))
    if phone:
        stmt = stmt.where(Student.phone.ilike(f"%{phone}%"))
    if batch_id:
        stmt = stmt.join(StudentBatch, StudentBatch.student_id == Student.id).where(StudentBatch.batch_id == batch_id)
    if unpaid_only:
        payment_sum = (
            select(func.coalesce(func.sum(Payment.amount), 0))
            .where(Payment.student_fee_id == StudentFee.id)
            .correlate(StudentFee)
            .scalar_subquery()
        )
        unpaid_student_ids = (
            select(StudentFee.student_id)
            .where(
                StudentFee.institute_id == current_user.institute_id,
                (StudentFee.total_fee - StudentFee.discount - payment_sum) > 0,
            )
            .distinct()
        )
        stmt = stmt.where(Student.id.in_(unpaid_student_ids))

    stmt = stmt.distinct()
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = list(
        db.scalars(
            stmt.order_by(Student.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
        )
    )
    return PaginatedResponse(
        total=total,
        page=page,
        page_size=page_size,
        items=[_serialize_student(student) for student in rows],
    )


@router.get("/{student_id}", response_model=StudentResponse)
def get_student(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StudentResponse:
    student = db.scalar(
        select(Student)
        .options(selectinload(Student.batch_links))
        .where(Student.id == student_id, Student.institute_id == current_user.institute_id)
    )
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
    if current_user.role == UserRole.STUDENT and current_user.student_id != student_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
    return _serialize_student(student)


@router.patch("/{student_id}", response_model=StudentResponse)
def update_student(
    student_id: int,
    payload: StudentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.TEACHER)),
) -> StudentResponse:
    student = db.scalar(
        select(Student)
        .options(selectinload(Student.batch_links))
        .where(Student.id == student_id, Student.institute_id == current_user.institute_id)
    )
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")

    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(student, key, value)

    db.commit()
    db.refresh(student)
    return _serialize_student(student)


@router.patch("/{student_id}/disable", response_model=StudentResponse)
def disable_student(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.TEACHER)),
) -> StudentResponse:
    student = db.scalar(
        select(Student)
        .options(selectinload(Student.batch_links))
        .where(Student.id == student_id, Student.institute_id == current_user.institute_id)
    )
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
    student.status = StudentStatus.DISABLED
    db.commit()
    db.refresh(student)
    return _serialize_student(student)


@router.put("/{student_id}/batches", response_model=StudentResponse)
def assign_batches(
    student_id: int,
    payload: StudentBatchAssignRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.TEACHER)),
) -> StudentResponse:
    student = db.scalar(
        select(Student)
        .options(selectinload(Student.batch_links))
        .where(Student.id == student_id, Student.institute_id == current_user.institute_id)
    )
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")

    valid_batch_ids = _validate_batch_ids(db, current_user.institute_id, payload.batch_ids)
    _replace_student_batches(db, current_user.institute_id, student.id, valid_batch_ids)
    db.commit()
    db.refresh(student)
    student = db.scalar(
        select(Student)
        .options(selectinload(Student.batch_links))
        .where(Student.id == student.id, Student.institute_id == current_user.institute_id)
    )
    return _serialize_student(student)

