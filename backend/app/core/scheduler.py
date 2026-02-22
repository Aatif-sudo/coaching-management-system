from datetime import UTC, datetime

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.core.database import SessionLocal


def build_scheduler() -> AsyncIOScheduler:
    scheduler = AsyncIOScheduler(timezone="UTC")
    scheduler.add_job(run_fee_reminder_job, "interval", minutes=30, id="fee-reminders", replace_existing=True)
    return scheduler


def run_fee_reminder_job() -> None:
    from app.services.reminder_service import generate_fee_reminders

    db = SessionLocal()
    try:
        generate_fee_reminders(db=db, run_date=datetime.now(UTC).date())
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

