from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import require_roles
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.auth import UserResponse

router = APIRouter()


@router.get("/teachers", response_model=list[UserResponse])
def list_teachers(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.TEACHER)),
) -> list[User]:
    return list(
        db.scalars(
            select(User).where(
                User.institute_id == current_user.institute_id,
                User.role == UserRole.TEACHER,
                User.is_active.is_(True),
            )
        )
    )

