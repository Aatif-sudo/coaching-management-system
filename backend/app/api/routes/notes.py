from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.core.storage import resolve_storage_path, save_note_file
from app.models.batch import Batch, StudentBatch
from app.models.enums import UserRole
from app.models.note import Note
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.note import NoteResponse

router = APIRouter()


def _can_student_access_batch(db: Session, student_id: int, batch_id: int) -> bool:
    link = db.scalar(select(StudentBatch).where(StudentBatch.student_id == student_id, StudentBatch.batch_id == batch_id))
    return link is not None


@router.post("/", response_model=NoteResponse, status_code=status.HTTP_201_CREATED)
def upload_note(
    batch_id: int = Form(...),
    title: str = Form(...),
    description: str | None = Form(default=None),
    tags: str | None = Form(default=None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.TEACHER)),
) -> Note:
    batch = db.scalar(select(Batch).where(Batch.id == batch_id, Batch.institute_id == current_user.institute_id))
    if not batch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Batch not found")

    relative_path, original_name, file_type = save_note_file(file)
    note = Note(
        institute_id=current_user.institute_id,
        batch_id=batch_id,
        title=title,
        description=description,
        tags=tags,
        file_name=original_name,
        file_path=relative_path,
        file_type=file_type,
        created_by=current_user.id,
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


@router.get("/", response_model=PaginatedResponse)
def list_notes(
    batch_id: int | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PaginatedResponse:
    stmt = select(Note).where(Note.institute_id == current_user.institute_id)
    if batch_id:
        stmt = stmt.where(Note.batch_id == batch_id)

    if current_user.role == UserRole.STUDENT:
        if not current_user.student_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Student profile missing")
        stmt = stmt.join(StudentBatch, StudentBatch.batch_id == Note.batch_id).where(
            StudentBatch.student_id == current_user.student_id
        )
    stmt = stmt.distinct()
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = list(
        db.scalars(
            stmt.order_by(Note.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
        )
    )
    return PaginatedResponse(
        total=total,
        page=page,
        page_size=page_size,
        items=[NoteResponse.model_validate(item).model_dump(mode="json") for item in rows],
    )


@router.get("/{note_id}/download")
def download_note(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FileResponse:
    note = db.scalar(select(Note).where(Note.id == note_id, Note.institute_id == current_user.institute_id))
    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")

    if current_user.role == UserRole.STUDENT:
        if not current_user.student_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Student profile missing")
        if not _can_student_access_batch(db, current_user.student_id, note.batch_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")

    try:
        file_path = resolve_storage_path(note.file_path)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid file path") from exc
    if not file_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stored file missing")

    return FileResponse(path=file_path, filename=note.file_name, media_type=note.file_type)
