from datetime import date, datetime

from pydantic import BaseModel, Field


class BatchBase(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    course: str = Field(min_length=2, max_length=200)
    schedule: str = Field(min_length=2, max_length=255)
    teacher_id: int | None = None
    start_date: date
    end_date: date | None = None
    fee_plan_id: int | None = None


class BatchCreate(BatchBase):
    pass


class BatchUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=200)
    course: str | None = Field(default=None, min_length=2, max_length=200)
    schedule: str | None = Field(default=None, min_length=2, max_length=255)
    teacher_id: int | None = None
    start_date: date | None = None
    end_date: date | None = None
    fee_plan_id: int | None = None


class BatchResponse(BatchBase):
    id: int
    institute_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BatchStudentResponse(BaseModel):
    id: int
    full_name: str
    phone: str | None
    email: str | None

