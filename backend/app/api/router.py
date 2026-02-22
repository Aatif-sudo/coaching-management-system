from fastapi import APIRouter

from app.api.routes import attendance, auth, batches, dashboard, fees, health, notes, notifications, students, users

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(students.router, prefix="/students", tags=["students"])
api_router.include_router(batches.router, prefix="/batches", tags=["batches"])
api_router.include_router(attendance.router, prefix="/attendance", tags=["attendance"])
api_router.include_router(notes.router, prefix="/notes", tags=["notes"])
api_router.include_router(fees.router, prefix="/fees", tags=["fees"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])

