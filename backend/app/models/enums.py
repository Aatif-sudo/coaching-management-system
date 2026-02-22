from enum import Enum


class UserRole(str, Enum):
    ADMIN = "ADMIN"
    TEACHER = "TEACHER"
    STUDENT = "STUDENT"


class StudentStatus(str, Enum):
    ACTIVE = "ACTIVE"
    DISABLED = "DISABLED"


class AttendanceStatus(str, Enum):
    PRESENT = "PRESENT"
    ABSENT = "ABSENT"


class FeePlanType(str, Enum):
    MONTHLY = "MONTHLY"
    QUARTERLY = "QUARTERLY"
    ONE_TIME = "ONE_TIME"
    CUSTOM = "CUSTOM"


class PaymentMode(str, Enum):
    CASH = "CASH"
    UPI = "UPI"
    BANK = "BANK"


class NotificationType(str, Enum):
    FEE_REMINDER = "FEE_REMINDER"
    ANNOUNCEMENT = "ANNOUNCEMENT"
    SYSTEM = "SYSTEM"

