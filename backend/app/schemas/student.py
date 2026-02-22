from datetime import date, datetime

from pydantic import BaseModel, EmailStr, Field

from app.models.enums import StudentStatus


class StudentBase(BaseModel):
    full_name: str = Field(min_length=2, max_length=150)
    phone: str | None = Field(default=None, max_length=20)
    email: EmailStr | None = None
    guardian_name: str | None = Field(default=None, max_length=150)
    guardian_phone: str | None = Field(default=None, max_length=20)
    address: str | None = None
    join_date: date
    status: StudentStatus = StudentStatus.ACTIVE


class StudentCreate(StudentBase):
    batch_ids: list[int] = Field(default_factory=list)


class StudentUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=150)
    phone: str | None = Field(default=None, max_length=20)
    email: EmailStr | None = None
    guardian_name: str | None = Field(default=None, max_length=150)
    guardian_phone: str | None = Field(default=None, max_length=20)
    address: str | None = None
    join_date: date | None = None
    status: StudentStatus | None = None


class StudentResponse(StudentBase):
    id: int
    institute_id: int
    created_at: datetime
    updated_at: datetime
    batch_ids: list[int] = Field(default_factory=list)

    class Config:
        from_attributes = True


class StudentBatchAssignRequest(BaseModel):
    batch_ids: list[int]

