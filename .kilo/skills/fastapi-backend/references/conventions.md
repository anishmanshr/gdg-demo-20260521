# Backend Conventions Reference

Reusable patterns, import paths, and code snippets used across every module. Read this after SKILL.md before implementing any code.

## Import Convention

All imports use absolute paths from the `app` package root, never relative. SQLAlchemy models use `async` variants.

```python
from app.core.config import settings
from app.core.security import create_access_token, verify_password
from app.core.error_handler import AppError
from app.core.event_bus import event_bus
from app.models import User, Job, Batch
from app.schemas.common import single_response, paginated_response
from app.schemas.jobs import JobResponse, CreateJobRequest
from app.modules.auth.dependencies import get_current_user, get_optional_user
from app.modules.common.dependencies import pagination, rate_limit

from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from fastapi import APIRouter, Depends, Query, UploadFile, File, Form
```

## Error Helpers

### Raising errors in services

Use AppError with the codes from `docs/architecture/api-reference.md`:

```python
from app.core.error_handler import AppError

# 404
raise AppError(code="not_found", message="Job not found", status_code=404)

# 403 permission denied
raise AppError(code="forbidden", message="You don't own this resource", status_code=403)

# 403 plan gated
raise AppError(code="plan_gated", message="Batch translation requires a paid plan", status_code=403)

# 402 quota exceeded
raise AppError(code="quota_exceeded", message="Monthly page quota exceeded", status_code=402)

# 409 duplicate
raise AppError(code="duplicate", message="A glossary with this name already exists", status_code=409)

# 400 validation
raise AppError(
    code="unsupported_format",
    message=f"Format '.xyz' is not supported",
    status_code=400,
    details=[{"extension": "xyz", "message": "Unsupported file format"}]
)
```

### AppError class

```python
# backend/app/core/error_handler.py
class AppError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = 400,
        details: list[dict] | None = None,
    ):
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or []
```

## Service Layer Pattern

Every service function is `async def`. Functions accept explicit dependencies — callers provide the DB session, user_id, and other params. No global state, no implicit context.

```python
# backend/app/modules/jobs/service.py
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.job import Job
from app.core.error_handler import AppError

async def list_jobs(
    db: AsyncSession,
    user_id: UUID,
    offset: int = 0,
    limit: int = 20,
    status: str | None = None,
) -> tuple[list[Job], int]:
    query = select(Job).where(Job.user_id == user_id)
    if status:
        query = query.where(Job.status == status)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar()

    query = query.order_by(Job.created_at.desc()).offset(offset).limit(limit)
    items = (await db.execute(query)).scalars().all()

    return list(items), total

async def get_job(db: AsyncSession, job_id: UUID) -> Job:
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if job is None:
        raise AppError(code="not_found", message="Job not found", status_code=404)
    return job

async def delete_job(db: AsyncSession, job_id: UUID, user_id: UUID) -> None:
    job = await get_job(db, job_id)
    if job.user_id != user_id:
        raise AppError(code="forbidden", message="You don't own this job", status_code=403)
    await db.delete(job)
    await db.commit()
```

## Route Implementation Pattern

Routes are thin — they extract auth user, parse query params, call the service, format the response, and return.

```python
# backend/app/api/v1/jobs.py
from uuid import UUID
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas.common import single_response, paginated_response
from app.schemas.jobs import JobResponse
from app.modules.jobs import service as job_service
from app.modules.auth.dependencies import get_current_user
from app.modules.common.dependencies import pagination
from app.models.user import User

router = APIRouter(prefix="/jobs", tags=["jobs"])

@router.get("/")
async def list_jobs(
    pag: dict = Depends(pagination),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    items, total = await job_service.list_jobs(
        db, user.id, pag["offset"], pag["limit"]
    )
    return paginated_response(
        [JobResponse.model_validate(j) for j in items],
        pag["page"], pag["per_page"], total,
    )

@router.get("/{job_id}")
async def get_job(
    job_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    job = await job_service.get_job(db, job_id)
    if job.user_id != user.id:
        raise AppError(code="forbidden", message="Not your job", status_code=403)
    return single_response(JobResponse.model_validate(job))

@router.delete("/{job_id}", status_code=204)
async def delete_job(
    job_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await job_service.delete_job(db, job_id, user.id)
```

## SQLAlchemy Model Pattern

```python
# backend/app/models/job.py
import uuid
from datetime import datetime
from sqlalchemy import String, Integer, Float, DateTime, ForeignKey, Enum, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True
    )
    batch_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("batches.id", ondelete="SET NULL"), nullable=True
    )
    priority: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(
        Enum("queued", "parsing", "translating", "rebuilding", "completed", "failed", "retrying",
             name="job_status"),
        default="queued",
    )
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    max_attempts: Mapped[int] = mapped_column(Integer, default=3)
    source_lang: Mapped[str] = mapped_column(String(10))
    target_lang: Mapped[str] = mapped_column(String(10))
    provider_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("providers.id"), nullable=True
    )
    glossary_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("glossary.id"), nullable=True
    )
    original_filename: Mapped[str] = mapped_column(String(255))
    original_file_path: Mapped[str] = mapped_column(String(500))
    translated_file_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    download_url_expires_at: Mapped[datetime | None] = mapped_column(nullable=True)
    pages_consumed: Mapped[int] = mapped_column(Integer, default=0)
    progress_pct: Mapped[float] = mapped_column(Float, default=0.0)
    current_stage: Mapped[str | None] = mapped_column(String(20), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    callback_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    queued_at: Mapped[datetime | None] = mapped_column(nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        Index("ix_jobs_user_id", "user_id"),
        Index("ix_jobs_status", "status"),
        Index("ix_jobs_batch_id", "batch_id"),
        Index("ix_jobs_created_at", "created_at"),
    )

    # Relationships
    user: Mapped["User"] = relationship(back_populates="jobs")
    batch: Mapped["Batch"] = relationship(back_populates="jobs")
```

### Base model

```python
# backend/app/models/base.py
from sqlalchemy.orm import DeclarativeBase

class Base(DeclarativeBase):
    pass
```

## Pydantic Schema Pattern

```python
# backend/app/schemas/jobs.py
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict

class JobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    status: str
    source_lang: str
    target_lang: str
    original_filename: str
    pages_consumed: int
    progress_pct: float
    current_stage: str | None
    error_message: str | None
    created_at: datetime
    updated_at: datetime

class CreateJobRequest(BaseModel):
    source_lang: str
    target_lang: str
    glossary_id: UUID | None = None

class JobListResponse(BaseModel):
    data: list[JobResponse]
    meta: dict
```

## Auth Dependency Pattern

```python
# backend/app/modules/auth/dependencies.py
from fastapi import Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.security import decode_access_token, verify_api_key_hash
from app.core.error_handler import AppError
from app.models.user import User
from sqlalchemy import select

bearer_scheme = HTTPBearer(auto_error=False)

async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    if credentials is None:
        raise AppError(code="unauthenticated", message="Not authenticated", status_code=401)

    token = credentials.credentials
    if token.startswith("dt_sk_"):
        raise AppError(code="unauthenticated", message="API key not accepted here — use JWT", status_code=401)

    payload = decode_access_token(token)
    if payload is None:
        raise AppError(code="token_expired", message="Token expired or invalid", status_code=401)

    user = await db.get(User, payload["sub"])
    if user is None:
        raise AppError(code="unauthenticated", message="User not found", status_code=401)

    return user

async def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    if credentials is None:
        return None
    try:
        payload = decode_access_token(credentials.credentials)
        if payload:
            return await db.get(User, payload["sub"])
    except Exception:
        pass
    return None
```

## Event Bus Pattern

```python
# backend/app/core/event_bus.py
import json
import redis.asyncio as redis
from app.core.config import settings

class EventBus:
    def __init__(self):
        self._redis: redis.Redis | None = None
        self._subscribers: dict[str, list[callable]] = {}

    async def connect(self):
        self._redis = redis.from_url(settings.REDIS_URL)

    async def disconnect(self):
        if self._redis:
            await self._redis.close()

    async def publish(self, event: str, data: dict):
        message = json.dumps(data)
        if self._redis:
            await self._redis.publish(event, message)

    def subscribe(self, event: str):
        def decorator(func):
            self._subscribers.setdefault(event, []).append(func)
            return func
        return decorator

    async def start_listeners(self):
        if not self._redis:
            return
        pubsub = self._redis.pubsub()
        for event, handlers in self._subscribers.items():
            await pubsub.subscribe(event)
        async for message in pubsub.listen():
            if message["type"] == "message":
                data = json.loads(message["data"])
                for handler in self._subscribers.get(message["channel"].decode(), []):
                    await handler(data)

event_bus = EventBus()
```

## Router Registration Pattern

```python
# backend/app/api/v1/__init__.py
from fastapi import APIRouter
from .auth import router as auth_router
from .jobs import router as jobs_router
from .batches import router as batches_router
from .teams import router as teams_router
from .glossary import router as glossary_router
from .webhooks import router as webhooks_router
from .billing import router as billing_router
from .notifications import router as notifications_router
from .admin import router as admin_router

v1_router = APIRouter(prefix="/api/v1")

v1_router.include_router(auth_router)
v1_router.include_router(jobs_router)
v1_router.include_router(batches_router)
v1_router.include_router(teams_router)
v1_router.include_router(glossary_router)
v1_router.include_router(webhooks_router)
v1_router.include_router(billing_router)
v1_router.include_router(notifications_router)
v1_router.include_router(admin_router)
```

## App Factory Pattern

```python
# backend/app/main.py
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1 import v1_router
from app.core.config import settings
from app.core.error_handler import AppError, app_error_handler, validation_error_handler
from app.core.event_bus import event_bus
from app.models.base import Base
from app.db import engine

@asynccontextmanager
async def lifespan(app: FastAPI):
    await event_bus.connect()
    # Auto-create admin from env vars if no admin exists
    if settings.ADMIN_EMAIL and settings.ADMIN_PASSWORD:
        from app.modules.auth.service import bootstrap_admin_if_needed
        await bootstrap_admin_if_needed()
    yield
    await event_bus.disconnect()

app = FastAPI(
    title="Document Translator API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
)

app.add_exception_handler(AppError, app_error_handler)
app.add_exception_handler(RequestValidationError, validation_error_handler)

app.include_router(v1_router)

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.get("/ready")
async def ready():
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return {"status": "ok", "checks": {"db": "ok"}}
    except Exception:
        return {"status": "error", "checks": {"db": "unavailable"}}
```

## Testing Pattern

```python
# tests/integration/test_jobs.py
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.integration
async def test_list_jobs(db_session, auth_headers):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/jobs/", headers=auth_headers)
        assert response.status_code == 200
        body = response.json()
        assert "data" in body
        assert "meta" in body
        assert isinstance(body["data"], list)

@pytest.mark.integration
async def test_get_job_not_found(db_session, auth_headers):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/jobs/00000000-0000-0000-0000-000000000000", headers=auth_headers)
        assert response.status_code == 404
        body = response.json()
        assert body["error"]["code"] == "not_found"
```

## Phase 1 Starter Checklist

When building from scratch, create these files first (in order):

1. `backend/requirements.txt` — fastapi, uvicorn, sqlalchemy[asyncio], asyncpg, alembic, redis, celery, python-jose, bcrypt, pydantic-settings, python-multipart, httpx, stripe, boto3
2. `backend/app/core/config.py` — Pydantic BaseSettings with all env vars from `docs/architecture/deployment.md`
3. `backend/app/models/base.py` — DeclarativeBase
4. `backend/app/core/registry.py` — Base Registry class
5. `backend/app/core/error_handler.py` — AppError + exception handlers
6. `backend/app/schemas/common.py` — single_response, paginated_response helpers
7. `backend/app/core/security.py` — JWT, password hashing, API key hashing
8. `backend/app/core/event_bus.py` — EventBus class
9. `backend/app/models/` — All models from `docs/architecture/system-design.md`
10. `backend/app/modules/auth/service.py` — signup, login, refresh, password reset
11. `backend/app/modules/auth/dependencies.py` — get_current_user, get_optional_user
12. `backend/app/api/v1/auth.py` — auth endpoints
13. `backend/app/main.py` — App factory with lifespan, CORS, health checks
14. `backend/app/worker.py` — Celery app
15. `backend/Dockerfile`
16. `docker-compose.yml`
