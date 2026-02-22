from datetime import date, datetime

from pydantic import BaseModel, Field

from app.models.enums import AttendanceStatus


class AttendanceMarkItem(BaseModel):
    student_id: int
    status: AttendanceStatus


class AttendanceMarkRequest(BaseModel):
    batch_id: int
    date: date
    records: list[AttendanceMarkItem] = Field(min_length=1)


class AttendanceResponse(BaseModel):
    id: int
    batch_id: int
    student_id: int
    date: date
    status: AttendanceStatus
    marked_by: int
    created_at: datetime

    class Config:
        from_attributes = True


class AttendanceStatsResponse(BaseModel):
    student_id: int
    batch_id: int
    total_classes: int
    present_count: int
    absent_count: int
    attendance_percentage: float

