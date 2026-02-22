from collections.abc import Callable

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_token, oauth2_scheme
from app.models.enums import UserRole
from app.models.user import User


def get_current_user(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme),
) -> User:
    payload = decode_token(token, expected_type="access")
    user_id = int(payload["sub"])
    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Inactive user")
    return user


def require_roles(*roles: UserRole) -> Callable[[User], User]:
    def _role_dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return current_user

    return _role_dependency


def require_student_or_staff(
    student_id: int,
    current_user: User = Depends(get_current_user),
) -> User:
    if current_user.role in {UserRole.ADMIN, UserRole.TEACHER}:
        return current_user
    if current_user.role == UserRole.STUDENT and current_user.student_id == student_id:
        return current_user
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")

