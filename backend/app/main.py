from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import get_settings
from app.core.rate_limit import SimpleRateLimitMiddleware
from app.core.scheduler import build_scheduler
from app.core.storage import ensure_storage_dirs

settings = get_settings()


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
    )
    origins = [item.strip() for item in settings.cors_origins.split(",") if item.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(SimpleRateLimitMiddleware, limit_per_minute=settings.rate_limit_per_minute)
    app.include_router(api_router, prefix=settings.api_prefix)

    @app.on_event("startup")
    async def startup_event() -> None:
        ensure_storage_dirs()
        if settings.run_scheduler:
            scheduler = build_scheduler()
            scheduler.start()
            app.state.scheduler = scheduler

    @app.on_event("shutdown")
    async def shutdown_event() -> None:
        scheduler = getattr(app.state, "scheduler", None)
        if scheduler:
            scheduler.shutdown(wait=False)

    return app


app = create_app()

