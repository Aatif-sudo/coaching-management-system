import json
from typing import Any

from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog


def create_audit_log(
    db: Session,
    institute_id: int,
    actor_user_id: int | None,
    action: str,
    entity: str,
    entity_id: str,
    before: dict[str, Any] | None,
    after: dict[str, Any] | None,
) -> None:
    log = AuditLog(
        institute_id=institute_id,
        actor_user_id=actor_user_id,
        action=action,
        entity=entity,
        entity_id=entity_id,
        before_json=json.dumps(before) if before else None,
        after_json=json.dumps(after) if after else None,
    )
    db.add(log)

