from datetime import UTC, date, datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, case, false, func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.models.attendance import Attendance
from app.models.batch import Batch, StudentBatch
from app.models.enums import AttendanceStatus, NotificationType, UserRole
from app.models.fee import StudentFee
from app.models.note import Note
from app.models.notification import Notification
from app.models.student import Student
from app.models.user import User
from app.services.fee_service import calculate_due_amount, calculate_paid_amount, next_due_installment

router = APIRouter()


@router.get("/admin")
def admin_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.TEACHER)),
) -> dict:
    institute_id = current_user.institute_id
    total_students = db.scalar(select(func.count(Student.id)).where(Student.institute_id == institute_id)) or 0
    total_batches = db.scalar(select(func.count(Batch.id)).where(Batch.institute_id == institute_id)) or 0
    today = date.today()
    today_attendance = db.scalar(
        select(func.count(Attendance.id)).where(
            Attendance.institute_id == institute_id,
            Attendance.date == today,
            Attendance.status == AttendanceStatus.PRESENT,
        )
    ) or 0

    student_fees = list(
        db.scalars(
            select(StudentFee)
            .options(
                joinedload(StudentFee.student),
                joinedload(StudentFee.batch),
                joinedload(StudentFee.payments),
            )
            .where(StudentFee.institute_id == institute_id)
        )
    )
    unpaid_students = 0
    total_due = Decimal("0")
    upcoming = []
    for item in student_fees:
        due = calculate_due_amount(item)
        if due > 0:
            unpaid_students += 1
            total_due += due
            next_due_date, upcoming_amount = next_due_installment(item)
            upcoming.append(
                {
                    "student_name": item.student.full_name,
                    "batch_name": item.batch.name,
                    "next_due_date": next_due_date,
                    "due_amount": float(upcoming_amount or due),
                }
            )

    recent_notifications = list(
        db.scalars(
            select(Notification)
            .where(Notification.institute_id == institute_id)
            .order_by(Notification.created_at.desc())
            .limit(5)
        )
    )

    return {
        "total_students": total_students,
        "total_batches": total_batches,
        "today_present_records": today_attendance,
        "unpaid_students": unpaid_students,
        "total_due_amount": float(total_due),
        "upcoming_dues": upcoming[:10],
        "recent_notifications": [
            {
                "id": n.id,
                "type": n.type.value,
                "message": n.message,
                "created_at": n.created_at,
            }
            for n in recent_notifications
        ],
    }


@router.get("/student")
def student_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    if current_user.role != UserRole.STUDENT or not current_user.student_id:
        raise HTTPException(status_code=403, detail="Student access only")

    student = db.scalar(
        select(Student).where(
            Student.id == current_user.student_id,
            Student.institute_id == current_user.institute_id,
        )
    )
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")

    batch_ids = list(
        db.scalars(select(StudentBatch.batch_id).where(StudentBatch.student_id == student.id))
    )
    batches = list(
        db.scalars(
            select(Batch)
            .options(joinedload(Batch.teacher))
            .where(Batch.id.in_(batch_ids)) if batch_ids else select(Batch).where(Batch.id == -1)
        )
    )
    notes = list(
        db.scalars(
            select(Note).where(Note.batch_id.in_(batch_ids)).order_by(Note.created_at.desc()).limit(30)
        )
        if batch_ids
        else []
    )

    attendance_rows = db.execute(
        select(
            Attendance.batch_id,
            func.count(Attendance.id).label("total"),
            func.sum(case((Attendance.status == AttendanceStatus.PRESENT, 1), else_=0)).label("present"),
        ).where(
            Attendance.student_id == student.id,
            Attendance.institute_id == current_user.institute_id,
        ).group_by(
            Attendance.batch_id
        )
    ).all()

    attendance = [
        {
            "batch_id": row.batch_id,
            "total_classes": int(row.total),
            "present": int(row.present or 0),
            "percentage": round(((int(row.present or 0) / int(row.total)) * 100), 2) if int(row.total) else 0.0,
        }
        for row in attendance_rows
    ]

    student_fees = list(
        db.scalars(
            select(StudentFee)
            .options(joinedload(StudentFee.batch), joinedload(StudentFee.payments))
            .where(StudentFee.student_id == student.id)
        )
    )
    fee_cards = []
    total_due = Decimal("0")
    for student_fee in student_fees:
        paid = calculate_paid_amount(student_fee)
        due = calculate_due_amount(student_fee)
        total_due += due
        fee_cards.append(
            {
                "student_fee_id": student_fee.id,
                "batch_name": student_fee.batch.name,
                "total_fee": float(student_fee.total_fee),
                "discount": float(student_fee.discount),
                "paid_amount": float(paid),
                "due_amount": float(due),
                "payments": [
                    {
                        "id": p.id,
                        "amount": float(p.amount),
                        "date": p.paid_on,
                        "mode": p.mode.value,
                        "receipt_no": p.receipt_no,
                    }
                    for p in student_fee.payments
                ],
            }
        )

    notifications = list(
        db.scalars(
            select(Notification)
            .where(
                Notification.institute_id == current_user.institute_id,
                or_(
                    Notification.student_id == student.id,
                    and_(Notification.student_id.is_(None), Notification.batch_id.is_(None)),
                    and_(
                        Notification.student_id.is_(None),
                        Notification.batch_id.in_(batch_ids),
                        Notification.type.in_([NotificationType.ANNOUNCEMENT, NotificationType.FEE_REMINDER]),
                    )
                    if batch_ids
                    else false(),
                ),
            )
            .order_by(Notification.created_at.desc())
            .limit(30)
        )
    )

    return {
        "student": {
            "id": student.id,
            "full_name": student.full_name,
            "status": student.status.value,
        },
        "batches": [
            {
                "id": batch.id,
                "name": batch.name,
                "course": batch.course,
                "schedule": batch.schedule,
                "teacher_name": batch.teacher.full_name if batch.teacher else None,
            }
            for batch in batches
        ],
        "attendance": attendance,
        "fees": fee_cards,
        "total_due_amount": float(total_due),
        "notes": [
            {
                "id": note.id,
                "batch_id": note.batch_id,
                "title": note.title,
                "description": note.description,
                "file_name": note.file_name,
                "created_at": note.created_at,
            }
            for note in notes
        ],
        "notifications": [
            {
                "id": n.id,
                "message": n.message,
                "type": n.type.value,
                "created_at": n.created_at,
                "read_at": n.read_at,
            }
            for n in notifications
        ],
        "generated_at": datetime.now(UTC).isoformat(),
    }
