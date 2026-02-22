from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.models.enums import UserRole


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=150)
    email: EmailStr
    phone: str | None = Field(default=None, max_length=20)
    password: str = Field(min_length=6, max_length=128)
    role: UserRole
    student_id: int | None = None
    is_active: bool = True


class UserResponse(BaseModel):
    id: int
    full_name: str
    email: str
    phone: str | None
    role: UserRole
    is_active: bool
    student_id: int | None
    created_at: datetime

    class Config:
        from_attributes = True

