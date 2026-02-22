import json
from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.batch import Batch
from app.models.enums import NotificationType
from app.models.fee import ReminderRule, StudentFee
from app.models.notification import Notification
from app.models.student import Student
from app.services.fee_service import allocate_installment_outstanding, calculate_due_amount
from app.services.notification_service import build_whatsapp_template, send_email_if_configured


def _trigger_for_delta(delta_days: int, rule: ReminderRule) -> str | None:
    if delta_days == rule.days_before:
        return "before_due"
    if delta_days == 0 and rule.on_due_date:
        return "on_due"
    if delta_days < 0 and abs(delta_days) % max(rule.every_n_days_after_due, 1) == 0:
        return "after_due"
    return None


def _get_rules(db: Session, institute_id: int, batch_id: int) -> list[ReminderRule]:
    batch_rules = list(
        db.scalars(
            select(ReminderRule).where(
                ReminderRule.institute_id == institute_id,
                ReminderRule.batch_id == batch_id,
                ReminderRule.is_active.is_(True),
            )
        )
    )
    if batch_rules:
        return batch_rules
    global_rules = list(
        db.scalars(
            select(ReminderRule).where(
                ReminderRule.institute_id == institute_id,
                ReminderRule.batch_id.is_(None),
                ReminderRule.is_active.is_(True),
            )
        )
    )
    if global_rules:
        return global_rules
    return [
        ReminderRule(
            institute_id=institute_id,
            name="Default Rule",
            days_before=3,
            on_due_date=True,
            every_n_days_after_due=3,
            is_active=True,
        )
    ]


def generate_fee_reminders(db: Session, run_date: date) -> int:
    existing_notifications = list(
        db.scalars(select(Notification).where(Notification.type == NotificationType.FEE_REMINDER))
    )
    existing_keys: set[tuple[int | None, str, str, str]] = set()
    for item in existing_notifications:
        if not item.meta_json:
            continue
        meta = json.loads(item.meta_json)
        key = (
            item.student_id,
            str(meta.get("student_fee_id")),
            str(meta.get("due_date")),
            str(meta.get("trigger_day")),
        )
        existing_keys.add(key)

    student_fees = list(
        db.scalars(
            select(StudentFee)
            .options(
                joinedload(StudentFee.student),
                joinedload(StudentFee.batch),
                joinedload(StudentFee.payments),
            )
        )
    )

    created_count = 0
    for student_fee in student_fees:
        due_amount = calculate_due_amount(student_fee)
        if due_amount <= Decimal("0"):
            continue

        rules = _get_rules(db, student_fee.institute_id, student_fee.batch_id)
        student: Student = student_fee.student
        batch: Batch = student_fee.batch
        outstanding_installments = allocate_installment_outstanding(student_fee)

        for index, due_date, installment_due in outstanding_installments:
            delta = (due_date - run_date).days
            for rule in rules:
                trigger = _trigger_for_delta(delta, rule)
                if not trigger:
                    continue

                key = (student.id, str(student_fee.id), due_date.isoformat(), run_date.isoformat())
                if key in existing_keys:
                    continue

                message = (
                    f"Fee reminder: {student.full_name}, installment {index + 1} for batch {batch.name} "
                    f"is due {due_date.isoformat()}. Pending installment amount: INR {installment_due:.2f}. "
                    f"Total pending: INR {due_amount:.2f}."
                )
                meta = {
                    "student_fee_id": student_fee.id,
                    "batch_id": student_fee.batch_id,
                    "due_date": due_date.isoformat(),
                    "trigger": trigger,
                    "trigger_day": run_date.isoformat(),
                    "whatsapp_template": build_whatsapp_template(
                        student_name=student.full_name,
                        batch_name=batch.name,
                        due_amount=f"INR {installment_due:.2f}",
                        due_date=due_date.isoformat(),
                    ),
                }

                db.add(
                    Notification(
                        institute_id=student_fee.institute_id,
                        student_id=student.id,
                        batch_id=student_fee.batch_id,
                        type=NotificationType.FEE_REMINDER,
                        message=message,
                        meta_json=json.dumps(meta),
                    )
                )
                existing_keys.add(key)
                created_count += 1

                if student.email:
                    send_email_if_configured(
                        recipient=student.email,
                        subject="Fee Reminder",
                        message=message,
                    )

    return created_count
