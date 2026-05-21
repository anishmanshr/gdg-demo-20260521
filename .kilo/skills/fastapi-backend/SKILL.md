---
name: fastapi-backend
description: Build and modify the FastAPI backend for the document translation platform. Use this skill whenever the user asks to create backend endpoints, API routes, database models, FastAPI middleware, Celery workers, authentication logic, Pydantic schemas, Alembic migrations, or any server-side Python code. Also use this skill when the user mentions fastapi, backend, API, endpoint, route, worker, celery, sqlalchemy, pydantic, middleware, or asks to build any backend feature, module, or service. Even if the user just says "add a route" or "create a model", use this skill.
---

# FastAPI Backend

This skill governs the document translation platform's FastAPI backend. Every design decision, directory convention, and code pattern is documented under `docs/architecture/`. This skill tells you **how** to implement — the docs tell you **what** to build.

**Always read `references/conventions.md` after this file** — it contains reusable code snippets and import conventions used across every module.

## Quick Reference: Which Doc to Read

When a user asks about a specific topic, consult the corresponding doc before writing code:

| User asks about... | Read this doc |
|---|---|
| Which endpoints exist, request/response shapes, error codes | `docs/architecture/api-reference.md` |
| System architecture, tech stack, role hierarchy, pipeline | `docs/architecture/overview.md` |
| Component diagram, all DB entities, FK cascades, indexes | `docs/architecture/system-design.md` |
| Plugin registry pattern, extension points, directory layout | `docs/architecture/modular-design.md` |
| Event bus architecture, subscription styles, subscriber modules | `docs/architecture/event-bus.md` |
| Pipeline hook stages, context payloads, registration API | `docs/architecture/pipeline-hooks.md` |
| Auth (JWT, API keys), rate limiting, security headers, CORS | `docs/architecture/security.md` |
| Auth system design, TokenDTO/UserDTO, endpoint specs | `docs/architecture/auth.md` |
| Storage backends, LLM providers, rate limiter, page counting | `docs/architecture/infrastructure.md` |
| Celery queues, priority tiers, job states, SSE progress, queue position, wait time estimation | `docs/architecture/queue-priority.md` |
| Batch lifecycle, multi-file create, retry, cancel, zip download, status recomputation | `docs/architecture/batch-operations.md` |
| LLM provider interface, chunking, glossary injection, retries | `docs/architecture/translation-engine.md` |
| Webhook payloads, HMAC signing, retry policy, delivery log | `docs/architecture/webhooks.md` |
| Glossary CRUD, terms, import/export, prompt injection, error codes | `docs/architecture/glossary.md` |
| Notification events, channels, preferences, SSE, module layout, tests | `docs/architecture/notifications.md` (design), `docs/architecture/notifications-v2.md` (implementation) |
| Team CRUD, member RBAC, invitation lifecycle, pooled quota | `docs/architecture/teams.md` |
| Admin bootstrap (CLI, env var, setup wizard) | `docs/architecture/admin-bootstrap.md` |
| Billing/Stripe checkout, webhooks, subscriptions | `docs/architecture/billing.md` |
| Preview engine, side-by-side segments | `docs/architecture/preview-engine.md` |
| OAuth social login, Google/GitHub, account linking | `docs/architecture/oauth-integration.md` |
| Which features are Phase 1 vs Phase 2 vs Phase 3 | `docs/features/feature-matrix.md` |
| Docker Compose services, env vars, health checks | `docs/architecture/deployment.md` |
| Test pyramid, fixtures, commands, mock strategy | `docs/architecture/testing.md` |
| Per-format handlers, page counting, style preservation | `docs/features/format-support.md` |
| User journeys (public, auth, batch, webhook, teams) | `docs/features/user-flows.md` |

---

## Project Structure

The backend lives in `backend/`. Follow this exact directory layout — it is the design. Modules that don't exist yet should be created following the same pattern.

```
backend/
  app/
    main.py              # FastAPI app factory, router registration, startup/shutdown
    cli.py               # CLI commands (create-admin, promote-admin)
    worker.py            # Celery app factory, task discovery
    core/
      registry.py        # Base Registry class (Plugin Registry Pattern)
      event_bus.py       # Redis pub/sub + in-process event bus
      pipeline_hooks.py  # Six-stage pipeline hook registry
      config.py          # Central config loader (env vars)
      security.py        # JWT encode/decode, password hashing, API key handling
      error_handler.py   # FastAPI exception handlers for AppError, validation errors
      protocols/
        format_handler.py
        llm_provider.py
        notification_channel.py
        storage_backend.py
      subscribers/       # Event bus subscriber modules (auto-registered)
        __init__.py
        billing.py
        notifications.py
        webhooks.py
    services/
      formats/           # One module per format — register in __init__.py
        docx_handler.py
        pptx_handler.py
        xlsx_handler.py
        html_handler.py
        txt_handler.py
        md_handler.py
        yaml_handler.py
        srt_handler.py
        __init__.py       # FormatHandlerRegistry.register() calls
      llm/               # One module per LLM provider — register in __init__.py
        openai.py
        anthropic.py
        gemini.py
        ollama.py
        __init__.py       # Imports all providers (triggers registration)
      storage/           # Storage backends
        local.py
      translation/
        service.py
    notifications/       # Notification system
      service.py
      channels/
        in_app_channel.py
        email_channel.py
        __init__.py
    modules/             # Domain modules — each is self-contained
      auth/
        service.py        # Business logic (calls repository, never touches DB)
        repository.py     # Data access (SQLAlchemy queries, injected AsyncSession)
        dependencies.py   # FastAPI Depends() callables (get_current_user, etc.)
      jobs/
        service.py
        repository.py
        dependencies.py
      preview/
        service.py        # Side-by-side preview data assembly
        dto.py            # PreviewDTO, PreviewSegment
        dependencies.py   # FastAPI Depends() callables
      oauth/
        service.py        # OAuth callback/connect/disconnect orchestration
        providers.py      # Provider URL builders, token exchange, userinfo
        state.py          # Redis-backed CSRF state management
        repository.py     # OAuthAccount CRUD
        dto.py            # OAuthProviderUser, OAuthTokenDTO, OAuthStatusDTO
      batches/
        service.py
        repository.py
      teams/
        service.py
        repository.py
        dependencies.py
      glossary/
        service.py
        repository.py
      webhooks/
        service.py
        repository.py
      billing/
        service.py
        repository.py
      notifications/
        __init__.py
        service.py
        repository.py
        dependencies.py
        dto.py
        event_handlers.py
        messages.py
    api/                 # FastAPI route definitions
      v1/
        auth.py
        jobs.py
        preview.py
        oauth.py
        batches.py
        teams.py
        glossary.py
        webhooks.py
        billing.py
        notifications.py
        admin.py
        __init__.py      # Collects and mounts all routers under /api/v1
    models/              # SQLAlchemy ORM models
      base.py
      user.py
      job.py
      batch.py
      glossary.py
      webhook.py
      api_key.py
      provider.py
      plan.py
      subscription.py
      public_config.py
      team.py
      notification.py
      oauth_account.py
    schemas/             # Pydantic request/response schemas
      auth.py
      jobs.py
      preview.py
      oauth.py
      batches.py
      glossary.py
      webhooks.py
      api_keys.py
      billing.py
      notifications.py
      teams.py
      admin.py
      common.py           # Pagination, error envelope helpers
  alembic/
    env.py
    versions/
  tests/
    unit/
    integration/
    conftest.py
  requirements.txt
  Dockerfile
```

### Module Convention

Each domain module follows a strict three-layer separation:

```
modules/auth/
  repository.py   # Data access — all SQLAlchemy queries. Takes AsyncSession as explicit parameter.
  service.py      # Business logic — orchestrates operations, calls repository. Never touches DB directly.
  dependencies.py # FastAPI Depends() callables. Import from services.
```

**Layer rules:**
- `repository.py`: Only SQLAlchemy queries. Receives `AsyncSession` as explicit dependency. Returns ORM models or scalars. Never imports services or routes.
- `service.py`: Business logic and orchestration. Calls repository for data access. Receives `AsyncSession` and passes it through to the repository. Never imports routes.
- `api/v1/<domain>.py` (controller): Thin layer. Validates input with Pydantic schemas, calls service, returns response envelope via `single_response()` or `paginated_response()`. Never accesses DB directly.

Routes import services. Dependencies import services. Services import repositories. Repositories import models. All public functions are `async def`. Every function takes explicit dependencies rather than relying on global state.

**Size limits:** files ≤ 200 lines, functions ≤ 50 lines. If a file or function exceeds the limit, split it — extract helper functions, create sub-modules, or delegate to a new repository/service.

**DTO convention:** Use `@dataclass` for internal data transfer objects between service and controller layers. Pydantic is for request validation only. Services return dataclass instances; controllers pass them directly to `single_response()` / `paginated_response()`. Never pass raw dicts between layers.

---

## API Design

This is the most important section. Every API endpoint follows these rules precisely. Deviations break the frontend, external API consumers, and the testing strategy.

### Route Registration

Each domain gets its own file in `backend/app/api/v1/`. Each file creates an `APIRouter` with the domain prefix:

```python
# backend/app/api/v1/jobs.py
from fastapi import APIRouter

router = APIRouter(prefix="/jobs", tags=["jobs"])

@router.get("/")
async def list_jobs(...):
    ...

@router.get("/{job_id}")
async def get_job(...):
    ...
```

All routers are collected and mounted in `api/v1/__init__.py`:

```python
# backend/app/api/v1/__init__.py
from fastapi import APIRouter
from .auth import router as auth_router
from .jobs import router as jobs_router
from .batches import router as batches_router
# ...

v1_router = APIRouter(prefix="/api/v1")
v1_router.include_router(auth_router)
v1_router.include_router(jobs_router)
v1_router.include_router(batches_router)
# ...
```

The `v1_router` is then included in `main.py` at app creation. Health check endpoints (`/health`, `/ready`) go directly on the app, not under v1.

### Response Envelope

Two shapes only. No exceptions. This is non-negotiable because the frontend and external API consumers parse these mechanically.

**Single object** — `data` key, no `meta`:
```json
{ "data": { "id": "...", "status": "completed" } }
```

**Paginated list** — `data` array + `meta`:
```json
{
  "data": [ ... ],
  "meta": { "page": 1, "per_page": 20, "total": 156 }
}
```

Implement reusable helpers in `backend/app/schemas/common.py`:
```python
def single_response(data: Any) -> dict:
    return {"data": data}

def paginated_response(data: list, page: int, per_page: int, total: int) -> dict:
    return {"data": data, "meta": {"page": page, "per_page": per_page, "total": total}}
```

Use these everywhere — never construct the dict manually in a route.

### Error Envelope

Every error — validation, auth, quota, rate limit — uses this shape:
```json
{
  "error": {
    "code": "validation_error",
    "message": "Human-readable description",
    "details": [{ "field": "email", "message": "Invalid email format" }]
  }
}
```

Raise errors in services using a custom exception:
```python
class AppError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400, details: list = None):
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or []
```

Register exception handlers in `main.py`:
```python
from .core.error_handler import app_error_handler, validation_error_handler

app.add_exception_handler(AppError, app_error_handler)
app.add_exception_handler(RequestValidationError, validation_error_handler)
```

The handler converts AppError to the standard error envelope. Pydantic validation errors are converted to `details: [{ "field": "...", "message": "..." }]`.

The full error code table is in `docs/architecture/api-reference.md`. Never invent new error codes — check the table first. Rate limit errors (429) include a `retry_after` field in seconds.

### Auth Dependencies

Four levels, defined in `backend/app/modules/auth/dependencies.py`:

| Dependency | Returns | Behavior |
|---|---|---|
| `get_current_user` | `User` | Requires valid JWT. 401 `unauthenticated`. |
| `get_api_key_user` | `User` | Resolves `Authorization: Bearer dt_sk_...`. 401 `unauthenticated`. |
| `get_current_user_or_api_key` | `User` | JWT first, fallback to API key. 401 if neither. |
| `get_optional_user` | `User \| None` | User if JWT valid, None otherwise. Never 401. For public endpoints. |

Plan-gating dependency (returns a callable to use with Depends):
```python
require_feature("glossary")   # 403 plan_gated if plan doesn't include glossary
require_feature("batch")      # 403 plan_gated if plan doesn't include batch
```

Rate limiting dependency:
```python
Depends(rate_limit(resource="translations", per_hour=10))
# Adds X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset headers
# Raises 429 rate_limit_exceeded with retry_after on violation
```

Team role dependencies (for team-scoped endpoints):
```python
Depends(require_team_role(team_id, roles=["OWNER", "ADMIN"]))
```

### Pagination

Reusable dependency in `backend/app/modules/common/dependencies.py`:
```python
from fastapi import Query

async def pagination(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100)
) -> dict:
    return {
        "offset": (page - 1) * per_page,
        "limit": per_page,
        "page": page,
        "per_page": per_page,
    }
```

Usage:
```python
@router.get("/jobs")
async def list_jobs(
    pag: dict = Depends(pagination),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    items, total = await job_service.list(db, user.id, pag["offset"], pag["limit"])
    return paginated_response(
        [JobResponse.model_validate(j) for j in items],
        pag["page"], pag["per_page"], total,
    )
```

### File Upload

Single file → `UploadFile`:
```python
@router.post("/documents/submit")
async def submit_document(
    file: UploadFile = File(...),
    source_lang: str = Form(...),
    target_lang: str = Form(...),
):
```

Batch → `list[UploadFile]`:
```python
files: list[UploadFile] = File(...)
```

Always validate MIME type against the format allowlist before processing. Accepted MIME types per format are in `docs/features/format-support.md`. Reject with `unsupported_format` error code.

### SSE Streaming

Use `StreamingResponse` with `text/event-stream`:
```python
from starlette.responses import StreamingResponse

@router.get("/jobs/{job_id}/stream")
async def stream_job(job_id: UUID, user: User = Depends(get_current_user)):
    async def event_generator():
        pubsub = redis.pubsub()
        await pubsub.subscribe(f"job:{job_id}")
        try:
            async for message in pubsub.listen():
                if message["type"] == "message":
                    data = json.loads(message["data"])
                    yield f"event: status\ndata: {json.dumps(data)}\n\n"
        finally:
            await pubsub.unsubscribe(f"job:{job_id}")

    return StreamingResponse(event_generator(), media_type="text/event-stream")
```

Nginx must not buffer SSE connections — the location block is in `docs/architecture/deployment.md`.

### Schema Layering

Three schema categories — never reuse a response schema as a request schema:

| Category | Convention | Purpose |
|---|---|---|
| **Request** schemas | `CreateJobRequest`, `UpdateGlossaryRequest` | Validate incoming request bodies |
| **Response** schemas | `JobResponse`, `GlossaryResponse` | Serialize objects for API responses |
| **Internal** schemas | `JobCreate`, `GlossaryUpdate` | What the service layer passes around |

All Pydantic v2 with `from_attributes = True`:
```python
class JobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    status: str
    original_filename: str
    created_at: datetime
```

Use `model_validate()` for ORM-to-schema conversion, never dict unpacking.

---

## Core Patterns

### Plugin Registry Pattern

Every extension point uses this pattern. Implement the base once in `backend/app/core/registry.py`:

```python
from typing import Any

class Registry:
    _handlers: dict[str, Any] = {}

    @classmethod
    def register(cls, key: str, handler: Any) -> None:
        cls._handlers[key] = handler

    @classmethod
    def get(cls, key: str) -> Any:
        handler = cls._handlers.get(key)
        if handler is None:
            raise ValueError(f"No handler registered for '{key}'")
        return handler

    @classmethod
    def all(cls) -> list[str]:
        return list(cls._handlers.keys())
```

Each extension point (FormatHandlerRegistry, LLMProviderRegistry, NotificationChannelRegistry, StorageBackendRegistry) subclasses or follows this pattern. Registration happens in `__init__.py` files. Full protocol definitions in `docs/architecture/modular-design.md`.

### Event Bus

Redis pub/sub + in-process dispatch decouples modules. Supports two
subscription styles (decorator and imperative) and auto-registration
via subscriber modules in `core/subscribers/`.

```python
# Publishing
await event_bus.publish("job.completed", {"job_id": str(job.id), "user_id": str(job.user_id)})

# Subscribing (decorator style)
@event_bus.subscribe("job.completed")
async def on_job_completed(event: dict):
    ...

# Subscribing (imperative style, in a subscriber module)
def register():
    event_bus.on("job.completed", handle_job_completed)
```

In Phase 1 the event bus only provides the plumbing — not all events fire yet.
Phase 2 activates the full event catalog.
*See `docs/architecture/modular-design.md` for the event catalog and
`docs/architecture/event-bus.md` for the full architecture.*

### Pipeline Hooks

The translation pipeline emits six advisory hooks at each stage boundary.
Hooks receive a context dict and are wired in both `tasks/translate.py`
and `services/translation/service.py`.

*See `docs/architecture/pipeline-hooks.md` for the full context payloads,
registration API, and wiring locations.*

---

## Auth & Security

### JWT Implementation
- Algorithm: HS256
- Access token: 15-minute expiry, in-memory only on frontend
- Refresh token: 7-day expiry, httpOnly Secure SameSite=Strict cookie
- Silent refresh: at 12 minutes via `POST /api/v1/auth/refresh`
- Full specs: `docs/architecture/security.md`

### API Key Authentication
- Prefix: `dt_sk_live_` (prod) / `dt_sk_test_` (test)
- Stored as SHA-256 hash; raw key shown once at creation
- Resolved from `Authorization: Bearer dt_sk_live_abc...`
- Full specs: `docs/architecture/security.md`

### CORS
Add to `main.py` with frontend origin from config:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
)
```

### Security Headers
Custom middleware or the `secure` library. Full header table in `docs/architecture/security.md`.

### Rate Limiting
Sliding window counter in Redis with the key format `ratelimit:{resource}:{identifier}:{window}`. All responses include `X-RateLimit-*` headers. Tier-specific limits in `docs/architecture/security.md`.

---

## Models & Database

### Async SQLAlchemy
All database access is async. Use `AsyncSession` via dependency injection:
```python
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        yield session
```

### Model Conventions
- UUID primary keys (use `uuid.uuid4` server_default)
- `created_at` and `updated_at` columns with `server_default=func.now()`
- Enum types for status/type fields (use SQLAlchemy `Enum`)
- Explicit FK constraints with `ondelete` behavior
- BTREE indexes on all query columns

Every model corresponds to a documented entity. The complete entity list with all columns, FK cascades, and indexes is in `docs/architecture/system-design.md`. Never create a model without consulting this doc.

### Migrations
Use Alembic. Migration files in `backend/alembic/versions/`.
```bash
alembic revision --autogenerate -m "description"
alembic upgrade head
```

---

## Workers & Celery

### Task Design
The full translation pipeline runs as a single Celery task: parse → chunk → translate chunks → rebuild → notify. Tasks are defined in `backend/app/worker.py`.

### Queue Routing
Jobs are routed to queues by priority tier (admin=5, enterprise=4, retry=3, pro=2, free=1, public=0). Workers pull from highest non-empty queue first. Full routing config and worker pool setup: `docs/architecture/queue-priority.md`.

### SSE Progress
Workers publish progress to `job:{job_id}` Redis channel. The SSE endpoint subscribes and forwards. The event format is:
```
event: status
data: {"status": "translating", "progress_pct": 45, "current_chunk": 9, "total_chunks": 20}
```

---

## Testing

### Commands
```bash
# Unit (fast, no Docker)
pytest tests/unit/ -m "not integration"

# Integration (requires Docker for Postgres + Redis)
docker compose -f docker-compose.test.yml up -d
pytest tests/integration/ -m integration

# All with coverage
pytest --cov=app --cov-report=term --cov-report=html
```

### Key Fixtures
Define in `tests/conftest.py`:
- `db_session` — Fresh DB per test, rolled back
- `auth_headers(user)` — JWT Bearer header helper
- `test_user` / `admin_user` / `paid_user` — User fixtures
- `sample_docx_file` / `sample_pptx_file` — Test file bytes

Full fixture list and mock strategies: `docs/architecture/testing.md`.

### Mock Strategy
- LLM providers: mock `httpx.AsyncClient`
- Stripe: `stripe-python` mock or `responses` library
- Email: console backend; assert via mail outbox
- Redis: `fakeredis` for unit; real Redis in Docker for integration
- Celery: `CELERY_TASK_ALWAYS_EAGER=True` in integration tests

---

## Deployment

### Docker Compose
All services defined in `docker-compose.yml`: postgres, redis, api, worker, frontend, nginx. Full config: `docs/architecture/deployment.md`.

### Environment Variables
Check `docs/architecture/deployment.md` for all required and optional env vars. Never hardcode secrets — always reference from `backend/app/core/config.py`.

### Quick Commands
```bash
docker compose up                           # Start dev environment
docker compose exec api alembic upgrade head # Run migrations
docker compose exec api python -m app.cli create-admin --email admin@example.com --password "securePass123!"
open http://localhost:8000/docs              # Swagger UI
```

---

## Implementation Workflow

When the user asks to build a backend feature, follow this order:

1. **Check docs** — Read the relevant doc from the Quick Reference table above
2. **Check phase** — Confirm the feature's phase in `docs/features/feature-matrix.md`
3. **Create models** — If the feature needs new DB entities, create SQLAlchemy models and Alembic migration
4. **Create schemas** — Pydantic request/response schemas in `backend/app/schemas/`
5. **Build repository** — Data access layer in `backend/app/modules/{domain}/repository.py`
6. **Build service** — Business logic in `backend/app/modules/{domain}/service.py` (calls repository)
7. **Build dependencies** — Auth checks, rate limits, plan gates in `dependencies.py`
8. **Build routes** — FastAPI endpoints in `backend/app/api/v1/{domain}.py` (controller, calls service)
9. **Register routes** — Import the router in `api/v1/__init__.py`
10. **Write tests** — Integration test first, then unit tests for the service
11. **Verify** — Run tests and check the Swagger UI

### Phase Awareness

- **Phase 1** (MVP): Public + free translation, auth, all 8 formats, basic queue, rate limiting, admin bootstrap, event bus plumbing. Build these first.
- **Phase 2**: Plans/billing/Stripe, batch ops, glossaries, API keys, webhooks, notifications, teams, multi-provider admin panel. Built on Phase 1 foundations.
- **Phase 3**: Translation memory, scheduling, audit logs, custom roles, load testing. Do not build unless explicitly asked.
