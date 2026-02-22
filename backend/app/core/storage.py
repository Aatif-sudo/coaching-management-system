from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile

from app.core.config import get_settings

settings = get_settings()


def ensure_storage_dirs() -> None:
    Path(settings.storage_dir).mkdir(parents=True, exist_ok=True)
    (Path(settings.storage_dir) / "notes").mkdir(parents=True, exist_ok=True)
    (Path(settings.storage_dir) / "receipts").mkdir(parents=True, exist_ok=True)


def save_note_file(upload: UploadFile) -> tuple[str, str, str]:
    ensure_storage_dirs()
    extension = Path(upload.filename or "").suffix
    safe_filename = f"{uuid4().hex}{extension}"
    relative_path = Path("notes") / safe_filename
    absolute_path = Path(settings.storage_dir) / relative_path

    with absolute_path.open("wb") as file_obj:
        while True:
            chunk = upload.file.read(1024 * 1024)
            if not chunk:
                break
            file_obj.write(chunk)

    return str(relative_path), upload.filename or safe_filename, upload.content_type or "application/octet-stream"


def resolve_storage_path(relative_path: str) -> Path:
    base = Path(settings.storage_dir).resolve()
    resolved = (base / relative_path).resolve()
    if not str(resolved).startswith(str(base)):
        raise ValueError("Invalid file path")
    return resolved

