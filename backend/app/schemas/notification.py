from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import NotificationType


class NotificationResponse(BaseModel):
    id: int
    student_id: int | None
    batch_id: int | None
    type: NotificationType
    message: str
    meta_json: dict | None
    created_at: datetime
    read_at: datetime | None

    class Config:
        from_attributes = True


class AnnouncementCreate(BaseModel):
    message: str = Field(min_length=2)
    batch_id: int | None = None
    student_id: int | None = None


class ReminderRuleCreate(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    batch_id: int | None = None
    days_before: int = Field(default=3, ge=0, le=60)
    on_due_date: bool = True
    every_n_days_after_due: int = Field(default=3, ge=1, le=60)
    is_active: bool = True


class ReminderRuleUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=150)
    days_before: int | None = Field(default=None, ge=0, le=60)
    on_due_date: bool | None = None
    every_n_days_after_due: int | None = Field(default=None, ge=1, le=60)
    is_active: bool | None = None


class ReminderRuleResponse(BaseModel):
    id: int
    name: str
    batch_id: int | None
    days_before: int
    on_due_date: bool
    every_n_days_after_due: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

