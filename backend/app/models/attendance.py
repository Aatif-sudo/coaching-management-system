from datetime import date as dt_date

from sqlalchemy import Date, Enum, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin
from app.models.enums import AttendanceStatus


class Attendance(Base, TimestampMixin):
    __tablename__ = "attendance"
    __table_args__ = (UniqueConstraint("batch_id", "student_id", "date", name="uq_attendance_record"),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    institute_id: Mapped[int] = mapped_column(ForeignKey("institutes.id"), default=1, index=True, nullable=False)

    batch_id: Mapped[int] = mapped_column(ForeignKey("batches.id"), nullable=False, index=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), nullable=False, index=True)
    date: Mapped[dt_date] = mapped_column(Date, nullable=False, index=True)
    status: Mapped[AttendanceStatus] = mapped_column(Enum(AttendanceStatus, native_enum=False), nullable=False)
    marked_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    batch = relationship("Batch", back_populates="attendance_records")
    student = relationship("Student", back_populates="attendance_records")
    marked_by_user = relationship("User", back_populates="attendance_marked")
