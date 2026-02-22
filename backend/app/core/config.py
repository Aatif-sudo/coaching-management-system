from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Coaching Management System API"
    environment: str = "development"
    api_prefix: str = "/api/v1"

    secret_key: str = "change-me-in-env"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_minutes: int = 60 * 24 * 7

    database_url: str = "sqlite:///./coaching.db"
    storage_dir: str = str(Path(__file__).resolve().parents[2] / "storage")
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    rate_limit_per_minute: int = 120

    run_scheduler: bool = True
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_user: str | None = None
    smtp_password: str | None = None
    smtp_sender: str | None = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @field_validator("storage_dir", mode="before")
    @classmethod
    def normalize_storage_dir(cls, value: str) -> str:
        return str(Path(value).resolve())


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()

