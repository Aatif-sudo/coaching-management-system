from datetime import date

from sqlalchemy import Date, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin


class Batch(Base, TimestampMixin):
    __tablename__ = "batches"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    institute_id: Mapped[int] = mapped_column(ForeignKey("institutes.id"), default=1, index=True, nullable=False)

    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    course: Mapped[str] = mapped_column(String(200), nullable=False)
    schedule: Mapped[str] = mapped_column(String(255), nullable=False)
    teacher_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    fee_plan_id: Mapped[int | None] = mapped_column(ForeignKey("fee_plans.id"), nullable=True)

    institute = relationship("Institute", back_populates="batches")
    teacher = relationship("User", back_populates="taught_batches")
    fee_plan = relationship("FeePlan", back_populates="batches")
    student_links = relationship("StudentBatch", back_populates="batch", cascade="all, delete-orphan")
    attendance_records = relationship("Attendance", back_populates="batch")
    notes = relationship("Note", back_populates="batch")
    student_fees = relationship("StudentFee", back_populates="batch")
    reminder_rules = relationship("ReminderRule", back_populates="batch")


class StudentBatch(Base):
    __tablename__ = "student_batches"
    __table_args__ = (UniqueConstraint("student_id", "batch_id", name="uq_student_batch"),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    institute_id: Mapped[int] = mapped_column(ForeignKey("institutes.id"), default=1, index=True, nullable=False)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), nullable=False)
    batch_id: Mapped[int] = mapped_column(ForeignKey("batches.id"), nullable=False)

    student = relationship("Student", back_populates="batch_links")
    batch = relationship("Batch", back_populates="student_links")

