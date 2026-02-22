from datetime import datetime
from decimal import Decimal
from io import BytesIO

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

from app.models.batch import Batch
from app.models.fee import Payment, StudentFee
from app.models.student import Student


def _format_money(amount: Decimal | float) -> str:
    return f"INR {Decimal(str(amount)):.2f}"


def generate_receipt_pdf(
    payment: Payment,
    student_fee: StudentFee,
    student: Student,
    batch: Batch,
) -> bytes:
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    c.setFont("Helvetica-Bold", 18)
    c.drawString(20 * mm, height - 25 * mm, "Fee Payment Receipt")

    c.setFont("Helvetica", 11)
    c.drawString(20 * mm, height - 40 * mm, f"Receipt No: {payment.receipt_no}")
    c.drawString(20 * mm, height - 48 * mm, f"Date: {payment.paid_on}")

    c.setFont("Helvetica-Bold", 12)
    c.drawString(20 * mm, height - 62 * mm, "Student Details")
    c.setFont("Helvetica", 11)
    c.drawString(20 * mm, height - 70 * mm, f"Name: {student.full_name}")
    c.drawString(20 * mm, height - 78 * mm, f"Batch: {batch.name}")
    c.drawString(20 * mm, height - 86 * mm, f"Course: {batch.course}")

    c.setFont("Helvetica-Bold", 12)
    c.drawString(20 * mm, height - 102 * mm, "Payment Details")
    c.setFont("Helvetica", 11)
    c.drawString(20 * mm, height - 110 * mm, f"Amount Paid: {_format_money(payment.amount)}")
    c.drawString(20 * mm, height - 118 * mm, f"Mode: {payment.mode.value}")
    c.drawString(20 * mm, height - 126 * mm, f"Total Fee: {_format_money(student_fee.total_fee)}")
    c.drawString(20 * mm, height - 134 * mm, f"Discount: {_format_money(student_fee.discount)}")

    c.setFont("Helvetica-Oblique", 10)
    c.drawString(20 * mm, height - 148 * mm, f"Generated at: {datetime.utcnow().isoformat()}Z")

    c.showPage()
    c.save()
    return buffer.getvalue()

