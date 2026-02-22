import json
from datetime import date
from decimal import Decimal
from typing import Any

from app.models.fee import StudentFee


def parse_due_schedule(raw: str) -> list[dict[str, Any]]:
    loaded = json.loads(raw)
    if not isinstance(loaded, list):
        return []
    return loaded


def serialize_due_schedule(schedule: list[dict[str, Any]]) -> str:
    return json.dumps(schedule)


def calculate_paid_amount(student_fee: StudentFee) -> Decimal:
    total = Decimal("0")
    for payment in student_fee.payments:
        total += Decimal(str(payment.amount))
    return total


def calculate_total_due(student_fee: StudentFee) -> Decimal:
    return Decimal(str(student_fee.total_fee)) - Decimal(str(student_fee.discount))


def calculate_due_amount(student_fee: StudentFee) -> Decimal:
    return max(calculate_total_due(student_fee) - calculate_paid_amount(student_fee), Decimal("0"))


def next_due_installment(student_fee: StudentFee) -> tuple[str | None, Decimal | None]:
    schedule = parse_due_schedule(student_fee.due_schedule_json)
    if not schedule:
        return None, None

    paid_remaining = calculate_paid_amount(student_fee)
    sorted_schedule = sorted(schedule, key=lambda x: x["due_date"])

    for installment in sorted_schedule:
        installment_amount = Decimal(str(installment["amount"]))
        consumed = min(paid_remaining, installment_amount)
        outstanding = installment_amount - consumed
        paid_remaining -= consumed
        if outstanding > 0:
            return installment["due_date"], outstanding
    return None, None


def allocate_installment_outstanding(
    student_fee: StudentFee,
) -> list[tuple[int, date, Decimal]]:
    schedule = parse_due_schedule(student_fee.due_schedule_json)
    if not schedule:
        return []

    paid_remaining = calculate_paid_amount(student_fee)
    outstanding_rows: list[tuple[int, date, Decimal]] = []
    sorted_schedule = sorted(schedule, key=lambda x: x["due_date"])

    for index, installment in enumerate(sorted_schedule):
        installment_amount = Decimal(str(installment["amount"]))
        due_date = date.fromisoformat(str(installment["due_date"]))
        consumed = min(paid_remaining, installment_amount)
        unpaid = installment_amount - consumed
        paid_remaining -= consumed
        if unpaid > 0:
            outstanding_rows.append((index, due_date, unpaid))

    return outstanding_rows

