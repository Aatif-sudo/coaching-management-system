import json
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.models.batch import StudentBatch
from app.models.enums import NotificationType, UserRole
from app.models.fee import ReminderRule
from app.models.notification import Notification
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.notification import (
    AnnouncementCreate,
    NotificationResponse,
    ReminderRuleCreate,
    ReminderRuleResponse,
    ReminderRuleUpdate,
)
from app.services.reminder_service import generate_fee_reminders

router = APIRouter()


def _serialize_notification(notification: Notification) -> NotificationResponse:
    return NotificationResponse(
        id=notification.id,
        student_id=notification.student_id,
        batch_id=notification.batch_id,
        type=notification.type,
        message=notification.message,
        meta_json=json.loads(notification.meta_json) if notification.meta_json else None,
        created_at=notification.created_at,
        read_at=notification.read_at,
    )


def _student_batch_ids(db: Session, student_id: int) -> list[int]:
    return list(db.scalars(select(StudentBatch.batch_id).where(StudentBatch.student_id == student_id)))


def _student_can_access_notification(
    db: Session,
    student_id: int,
    notification: Notification,
) -> bool:
    if notification.student_id == student_id:
        return True
    if notification.student_id is None and notification.batch_id is None:
        return True
    if notification.student_id is None and notification.batch_id is not None:
        return notification.batch_id in _student_batch_ids(db, student_id)
    return False


@router.get("/", response_model=PaginatedResponse)
def list_notifications(
    type: NotificationType | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PaginatedResponse:
    stmt = select(Notification).where(Notification.institute_id == current_user.institute_id)

    if type:
        stmt = stmt.where(Notification.type == type)

    if current_user.role == UserRole.STUDENT:
        if not current_user.student_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Student profile missing")
        batch_ids = list(
            db.scalars(
                select(StudentBatch.batch_id).where(StudentBatch.student_id == current_user.student_id)
            )
        )
        clauses = [
            Notification.student_id == current_user.student_id,
            and_(Notification.student_id.is_(None), Notification.batch_id.is_(None)),
        ]
        if batch_ids:
            clauses.append(and_(Notification.student_id.is_(None), Notification.batch_id.in_(batch_ids)))
        stmt = stmt.where(or_(*clauses))

    stmt = stmt.distinct()
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    notifications = list(
        db.scalars(
            stmt.order_by(Notification.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
        )
    )
    return PaginatedResponse(
        total=total,
        page=page,
        page_size=page_size,
        items=[_serialize_notification(item) for item in notifications],
    )


@router.patch("/{notification_id}/read", response_model=NotificationResponse)
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> NotificationResponse:
    notification = db.scalar(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.institute_id == current_user.institute_id,
        )
    )
    if not notification:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    if current_user.role == UserRole.STUDENT:
        if not current_user.student_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Student profile missing")
        allowed = _student_can_access_notification(db, current_user.student_id, notification)
        if not allowed:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")

    notification.read_at = datetime.now(UTC)
    db.commit()
    db.refresh(notification)
    return _serialize_notification(notification)


@router.post("/announcements", response_model=NotificationResponse, status_code=status.HTTP_201_CREATED)
def create_announcement(
    payload: AnnouncementCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.TEACHER)),
) -> NotificationResponse:
    notification = Notification(
        institute_id=current_user.institute_id,
        student_id=payload.student_id,
        batch_id=payload.batch_id,
        type=NotificationType.ANNOUNCEMENT,
        message=payload.message,
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return _serialize_notification(notification)


@router.post("/reminder-rules", response_model=ReminderRuleResponse, status_code=status.HTTP_201_CREATED)
def create_reminder_rule(
    payload: ReminderRuleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
) -> ReminderRule:
    rule = ReminderRule(
        institute_id=current_user.institute_id,
        name=payload.name,
        batch_id=payload.batch_id,
        days_before=payload.days_before,
        on_due_date=payload.on_due_date,
        every_n_days_after_due=payload.every_n_days_after_due,
        is_active=payload.is_active,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


@router.get("/reminder-rules", response_model=list[ReminderRuleResponse])
def list_reminder_rules(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.TEACHER)),
) -> list[ReminderRule]:
    return list(
        db.scalars(
            select(ReminderRule)
            .where(ReminderRule.institute_id == current_user.institute_id)
            .order_by(ReminderRule.created_at.desc())
        )
    )


@router.patch("/reminder-rules/{rule_id}", response_model=ReminderRuleResponse)
def update_reminder_rule(
    rule_id: int,
    payload: ReminderRuleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
) -> ReminderRule:
    rule = db.scalar(
        select(ReminderRule).where(ReminderRule.id == rule_id, ReminderRule.institute_id == current_user.institute_id)
    )
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found")
    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(rule, key, value)
    db.commit()
    db.refresh(rule)
    return rule


@router.delete("/reminder-rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_reminder_rule(
    rule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
) -> None:
    rule = db.scalar(
        select(ReminderRule).where(ReminderRule.id == rule_id, ReminderRule.institute_id == current_user.institute_id)
    )
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found")
    db.delete(rule)
    db.commit()
    return None


@router.post("/run-reminders")
def run_reminders(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.TEACHER)),
) -> dict:
    created = generate_fee_reminders(db=db, run_date=datetime.now(UTC).date())
    db.commit()
    return {"created_notifications": created}


@router.get("/{notification_id}/whatsapp-template")
def whatsapp_template(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    notification = db.scalar(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.institute_id == current_user.institute_id,
        )
    )
    if not notification:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    if current_user.role == UserRole.STUDENT:
        if not current_user.student_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Student profile missing")
        allowed = _student_can_access_notification(db, current_user.student_id, notification)
        if not allowed:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")

    meta = json.loads(notification.meta_json) if notification.meta_json else {}
    return {"template": meta.get("whatsapp_template", notification.message)}
