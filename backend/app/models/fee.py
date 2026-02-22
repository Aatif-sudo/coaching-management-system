from sqlalchemy import Enum, ForeignKey, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin
from app.models.enums import FeePlanType, PaymentMode


class FeePlan(Base, TimestampMixin):
    __tablename__ = "fee_plans"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    institute_id: Mapped[int] = mapped_column(ForeignKey("institutes.id"), default=1, index=True, nullable=False)

    name: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    type: Mapped[FeePlanType] = mapped_column(Enum(FeePlanType, native_enum=False), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    metadata_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    batches = relationship("Batch", back_populates="fee_plan")
    student_fees = relationship("StudentFee", back_populates="fee_plan")


class StudentFee(Base, TimestampMixin):
    __tablename__ = "student_fees"
    __table_args__ = (UniqueConstraint("student_id", "batch_id", name="uq_student_fee_student_batch"),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    institute_id: Mapped[int] = mapped_column(ForeignKey("institutes.id"), default=1, index=True, nullable=False)

    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), nullable=False, index=True)
    batch_id: Mapped[int] = mapped_column(ForeignKey("batches.id"), nullable=False, index=True)
    fee_plan_id: Mapped[int | None] = mapped_column(ForeignKey("fee_plans.id"), nullable=True)
    total_fee: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    discount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    due_schedule_json: Mapped[str] = mapped_column(Text, nullable=False)

    student = relationship("Student", back_populates="student_fees")
    batch = relationship("Batch", back_populates="student_fees")
    fee_plan = relationship("FeePlan", back_populates="student_fees")
    payments = relationship("Payment", back_populates="student_fee", cascade="all, delete-orphan")


class Payment(Base, TimestampMixin):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    institute_id: Mapped[int] = mapped_column(ForeignKey("institutes.id"), default=1, index=True, nullable=False)

    student_fee_id: Mapped[int] = mapped_column(ForeignKey("student_fees.id"), nullable=False, index=True)
    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    paid_on: Mapped[str] = mapped_column(String(30), nullable=False)
    mode: Mapped[PaymentMode] = mapped_column(Enum(PaymentMode, native_enum=False), nullable=False)
    receipt_no: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    student_fee = relationship("StudentFee", back_populates="payments")
    creator = relationship("User", back_populates="created_payments")


class ReminderRule(Base, TimestampMixin):
    __tablename__ = "reminder_rules"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    institute_id: Mapped[int] = mapped_column(ForeignKey("institutes.id"), default=1, index=True, nullable=False)

    batch_id: Mapped[int | None] = mapped_column(ForeignKey("batches.id"), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    days_before: Mapped[int] = mapped_column(nullable=False, default=3)
    on_due_date: Mapped[bool] = mapped_column(nullable=False, default=True)
    every_n_days_after_due: Mapped[int] = mapped_column(nullable=False, default=3)
    is_active: Mapped[bool] = mapped_column(nullable=False, default=True)

    batch = relationship("Batch", back_populates="reminder_rules")

