from datetime import datetime

from pydantic import BaseModel


class NoteResponse(BaseModel):
    id: int
    batch_id: int
    title: str
    description: str | None
    tags: str | None
    file_name: str
    file_type: str
    created_by: int
    created_at: datetime

    class Config:
        from_attributes = True

