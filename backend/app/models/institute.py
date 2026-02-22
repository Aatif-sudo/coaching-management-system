from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin


class Institute(Base, TimestampMixin):
    __tablename__ = "institutes"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)

    users = relationship("User", back_populates="institute")
    students = relationship("Student", back_populates="institute")
    batches = relationship("Batch", back_populates="institute")

