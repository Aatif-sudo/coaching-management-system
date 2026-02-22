import json
from datetime import date, datetime
from decimal import Decimal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.core.audit import create_audit_log
from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.models.batch import Batch, StudentBatch
from app.models.enums import UserRole
from app.models.fee import FeePlan, Payment, StudentFee
from app.models.student import Student
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.fee import (
    DueItemResponse,
    FeePlanCreate,
    FeePlanResponse,
    FeePlanUpdate,
    PaymentCreate,
    PaymentResponse,
    StudentFeeCreate,
    StudentFeeResponse,
)
from app.services.fee_service import (
    calculate_due_amount,
    calculate_paid_amount,
    next_due_installment,
    parse_due_schedule,
    serialize_due_schedule,
)
from app.services.receipt_service import generate_receipt_pdf

router = APIRouter()


def _serialize_fee_plan(plan: FeePlan) -> FeePlanResponse:
    metadata = json.loads(plan.metadata_json) if plan.metadata_json else None
    return FeePlanResponse(
        id=plan.id,
        name=plan.name,
        type=plan.type,
        amount=plan.amount,
        metadata_json=metadata,
        created_at=plan.created_at,
    )


def _serialize_student_fee(student_fee: StudentFee) -> StudentFeeResponse:
    due_schedule = parse_due_schedule(student_fee.due_schedule_json)
    paid_amount = calculate_paid_amount(student_fee)
    due_amount = calculate_due_amount(student_fee)
    return StudentFeeResponse(
        id=student_fee.id,
        student_id=student_fee.student_id,
        batch_id=student_fee.batch_id,
        fee_plan_id=student_fee.fee_plan_id,
        total_fee=student_fee.total_fee,
        discount=student_fee.discount,
        due_schedule=due_schedule,
        paid_amount=paid_amount,
        due_amount=due_amount,
        created_at=student_fee.created_at,
    )


@router.post("/plans", response_model=FeePlanResponse, status_code=status.HTTP_201_CREATED)
def create_fee_plan(
    payload: FeePlanCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.TEACHER)),
) -> FeePlanResponse:
    plan = FeePlan(
        institute_id=current_user.institute_id,
        name=payload.name,
        type=payload.type,
        amount=payload.amount,
        metadata_json=json.dumps(payload.metadata_json) if payload.metadata_json else None,
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return _serialize_fee_plan(plan)


@router.get("/plans", response_model=list[FeePlanResponse])
def list_fee_plans(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.TEACHER)),
) -> list[FeePlanResponse]:
    plans = list(
        db.scalars(
            select(FeePlan)
            .where(FeePlan.institute_id == current_user.institute_id)
            .order_by(FeePlan.created_at.desc())
        )
    )
    return [_serialize_fee_plan(plan) for plan in plans]


@router.patch("/plans/{plan_id}", response_model=FeePlanResponse)
def update_fee_plan(
    plan_id: int,
    payload: FeePlanUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.TEACHER)),
) -> FeePlanResponse:
    plan = db.scalar(select(FeePlan).where(FeePlan.id == plan_id, FeePlan.institute_id == current_user.institute_id))
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fee plan not found")

    updates = payload.model_dump(exclude_unset=True)
    if "metadata_json" in updates:
        updates["metadata_json"] = json.dumps(updates["metadata_json"]) if updates["metadata_json"] else None
    for key, value in updates.items():
        setattr(plan, key, value)
    db.commit()
    db.refresh(plan)
    return _serialize_fee_plan(plan)


@router.delete("/plans/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_fee_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
) -> None:
    plan = db.scalar(select(FeePlan).where(FeePlan.id == plan_id, FeePlan.institute_id == current_user.institute_id))
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fee plan not found")
    db.delete(plan)
    db.commit()
    return None


@router.patch("/batches/{batch_id}/plan", response_model=dict)
def assign_fee_plan_to_batch(
    batch_id: int,
    fee_plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.TEACHER)),
) -> dict:
    batch = db.scalar(select(Batch).where(Batch.id == batch_id, Batch.institute_id == current_user.institute_id))
    if not batch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Batch not found")
    plan = db.scalar(select(FeePlan).where(FeePlan.id == fee_plan_id, FeePlan.institute_id == current_user.institute_id))
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fee plan not found")
    batch.fee_plan_id = fee_plan_id
    db.commit()
    return {"batch_id": batch_id, "fee_plan_id": fee_plan_id}


@router.post("/student-fees", response_model=StudentFeeResponse, status_code=status.HTTP_201_CREATED)
def create_student_fee(
    payload: StudentFeeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.TEACHER)),
) -> StudentFeeResponse:
    student = db.scalar(
        select(Student).where(Student.id == payload.student_id, Student.institute_id == current_user.institute_id)
    )
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
    batch = db.scalar(select(Batch).where(Batch.id == payload.batch_id, Batch.institute_id == current_user.institute_id))
    if not batch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Batch not found")
    link = db.scalar(
        select(StudentBatch).where(
            StudentBatch.student_id == payload.student_id,
            StudentBatch.batch_id == payload.batch_id,
        )
    )
    if not link:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Student must be assigned to batch before fee mapping",
        )
    if payload.fee_plan_id:
        plan = db.scalar(
            select(FeePlan).where(FeePlan.id == payload.fee_plan_id, FeePlan.institute_id == current_user.institute_id)
        )
        if not plan:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fee plan not found")

    existing = db.scalar(
        select(StudentFee).where(
            StudentFee.student_id == payload.student_id,
            StudentFee.batch_id == payload.batch_id,
            StudentFee.institute_id == current_user.institute_id,
        )
    )
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Student fee mapping already exists")

    due_schedule = [
        {"due_date": item.due_date, "amount": str(item.amount)}
        for item in payload.due_schedule
    ]
    student_fee = StudentFee(
        institute_id=current_user.institute_id,
        student_id=payload.student_id,
        batch_id=payload.batch_id,
        fee_plan_id=payload.fee_plan_id,
        total_fee=payload.total_fee,
        discount=payload.discount,
        due_schedule_json=serialize_due_schedule(due_schedule),
    )
    db.add(student_fee)
    db.commit()
    db.refresh(student_fee)
    student_fee = db.scalar(
        select(StudentFee)
        .options(joinedload(StudentFee.payments))
        .where(StudentFee.id == student_fee.id)
    )
    return _serialize_student_fee(student_fee)


@router.get("/student-fees", response_model=PaginatedResponse)
def list_student_fees(
    student_id: int | None = Query(default=None),
    batch_id: int | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PaginatedResponse:
    stmt = (
        select(StudentFee)
        .options(joinedload(StudentFee.payments))
        .where(StudentFee.institute_id == current_user.institute_id)
    )
    if student_id:
        stmt = stmt.where(StudentFee.student_id == student_id)
    if batch_id:
        stmt = stmt.where(StudentFee.batch_id == batch_id)

    if current_user.role == UserRole.STUDENT:
        if not current_user.student_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Student profile missing")
        stmt = stmt.where(StudentFee.student_id == current_user.student_id)

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = list(
        db.scalars(
            stmt.order_by(StudentFee.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
        )
    )
    items = [_serialize_student_fee(item) for item in rows]
    return PaginatedResponse(total=total, page=page, page_size=page_size, items=items)


@router.post("/payments", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED)
def create_payment(
    payload: PaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.TEACHER)),
) -> Payment:
    student_fee = db.scalar(
        select(StudentFee)
        .options(joinedload(StudentFee.payments))
        .where(StudentFee.id == payload.student_fee_id, StudentFee.institute_id == current_user.institute_id)
    )
    if not student_fee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student fee mapping not found")

    current_due = calculate_due_amount(student_fee)
    if Decimal(str(payload.amount)) > current_due:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Payment exceeds due amount")

    receipt_no = f"RCPT-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{uuid4().hex[:6].upper()}"
    payment = Payment(
        institute_id=current_user.institute_id,
        student_fee_id=payload.student_fee_id,
        amount=payload.amount,
        paid_on=payload.paid_on,
        mode=payload.mode,
        receipt_no=receipt_no,
        remarks=payload.remarks,
        created_by=current_user.id,
    )
    db.add(payment)
    db.flush()
    create_audit_log(
        db=db,
        institute_id=current_user.institute_id,
        actor_user_id=current_user.id,
        action="FEE_PAYMENT_CREATED",
        entity="payment",
        entity_id=str(payment.id),
        before=None,
        after={
            "student_fee_id": payload.student_fee_id,
            "amount": str(payload.amount),
            "mode": payload.mode.value,
            "receipt_no": receipt_no,
        },
    )
    db.commit()
    db.refresh(payment)
    return payment


@router.get("/payments", response_model=PaginatedResponse)
def list_payments(
    student_fee_id: int | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PaginatedResponse:
    stmt = (
        select(Payment)
        .join(StudentFee, StudentFee.id == Payment.student_fee_id)
        .where(Payment.institute_id == current_user.institute_id)
    )
    if student_fee_id:
        stmt = stmt.where(Payment.student_fee_id == student_fee_id)
    if current_user.role == UserRole.STUDENT:
        if not current_user.student_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Student profile missing")
        stmt = stmt.where(StudentFee.student_id == current_user.student_id)
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = list(
        db.scalars(
            stmt.order_by(Payment.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
        )
    )
    return PaginatedResponse(
        total=total,
        page=page,
        page_size=page_size,
        items=[PaymentResponse.model_validate(item).model_dump(mode="json") for item in rows],
    )


@router.get("/payments/{payment_id}/receipt")
def download_receipt(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    payment = db.scalar(
        select(Payment)
        .options(
            joinedload(Payment.student_fee).joinedload(StudentFee.student),
            joinedload(Payment.student_fee).joinedload(StudentFee.batch),
        )
        .where(Payment.id == payment_id, Payment.institute_id == current_user.institute_id)
    )
    if not payment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")

    if current_user.role == UserRole.STUDENT:
        if not current_user.student_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Student profile missing")
        if payment.student_fee.student_id != current_user.student_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")

    pdf_bytes = generate_receipt_pdf(
        payment=payment,
        student_fee=payment.student_fee,
        student=payment.student_fee.student,
        batch=payment.student_fee.batch,
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=receipt-{payment.receipt_no}.pdf"},
    )


@router.get("/dues", response_model=list[DueItemResponse])
def list_dues(
    batch_id: int | None = Query(default=None),
    student_id: int | None = Query(default=None),
    due_from: date | None = Query(default=None),
    due_to: date | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[DueItemResponse]:
    stmt = (
        select(StudentFee)
        .options(
            joinedload(StudentFee.student),
            joinedload(StudentFee.batch),
            joinedload(StudentFee.payments),
        )
        .where(StudentFee.institute_id == current_user.institute_id)
    )
    if batch_id:
        stmt = stmt.where(StudentFee.batch_id == batch_id)
    if student_id:
        stmt = stmt.where(StudentFee.student_id == student_id)
    if current_user.role == UserRole.STUDENT:
        if not current_user.student_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Student profile missing")
        stmt = stmt.where(StudentFee.student_id == current_user.student_id)

    student_fees = list(db.scalars(stmt))
    results: list[DueItemResponse] = []
    for student_fee in student_fees:
        due_amount = calculate_due_amount(student_fee)
        if due_amount <= Decimal("0"):
            continue
        next_due_date, upcoming_amount = next_due_installment(student_fee)
        if due_from and next_due_date and date.fromisoformat(next_due_date) < due_from:
            continue
        if due_to and next_due_date and date.fromisoformat(next_due_date) > due_to:
            continue

        results.append(
            DueItemResponse(
                student_fee_id=student_fee.id,
                student_id=student_fee.student_id,
                student_name=student_fee.student.full_name,
                batch_id=student_fee.batch_id,
                batch_name=student_fee.batch.name,
                total_fee=student_fee.total_fee,
                discount=student_fee.discount,
                paid_amount=calculate_paid_amount(student_fee),
                due_amount=due_amount,
                next_due_date=next_due_date,
                upcoming_due_amount=upcoming_amount,
            )
        )
    return results
