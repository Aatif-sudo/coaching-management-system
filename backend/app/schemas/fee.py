from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from app.models.enums import FeePlanType, PaymentMode


class FeePlanBase(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    type: FeePlanType
    amount: Decimal = Field(gt=0)
    metadata_json: dict | None = None


class FeePlanCreate(FeePlanBase):
    pass


class FeePlanUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=150)
    type: FeePlanType | None = None
    amount: Decimal | None = Field(default=None, gt=0)
    metadata_json: dict | None = None


class FeePlanResponse(BaseModel):
    id: int
    name: str
    type: FeePlanType
    amount: Decimal
    metadata_json: dict | None
    created_at: datetime

    class Config:
        from_attributes = True


class FeeInstallment(BaseModel):
    due_date: str
    amount: Decimal = Field(gt=0)


class StudentFeeCreate(BaseModel):
    student_id: int
    batch_id: int
    fee_plan_id: int | None = None
    total_fee: Decimal = Field(gt=0)
    discount: Decimal = Field(default=0, ge=0)
    due_schedule: list[FeeInstallment] = Field(min_length=1)


class StudentFeeResponse(BaseModel):
    id: int
    student_id: int
    batch_id: int
    fee_plan_id: int | None
    total_fee: Decimal
    discount: Decimal
    due_schedule: list[FeeInstallment]
    paid_amount: Decimal
    due_amount: Decimal
    created_at: datetime


class PaymentCreate(BaseModel):
    student_fee_id: int
    amount: Decimal = Field(gt=0)
    paid_on: str
    mode: PaymentMode
    remarks: str | None = None


class PaymentResponse(BaseModel):
    id: int
    student_fee_id: int
    amount: Decimal
    paid_on: str
    mode: PaymentMode
    receipt_no: str
    remarks: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class DueItemResponse(BaseModel):
    student_fee_id: int
    student_id: int
    student_name: str
    batch_id: int
    batch_name: str
    total_fee: Decimal
    discount: Decimal
    paid_amount: Decimal
    due_amount: Decimal
    next_due_date: str | None
    upcoming_due_amount: Decimal | None

