# Document Translation Platform

## For plan mode

Before producing a plan, always read the relevant docs:

1. If the request involves APIs, endpoints, or backend: load `fastapi-backend` skill and consult its quick-reference table to find relevant docs
2. If the request involves pages, components, or frontend: load `frontend-app` skill and consult its quick-reference table to find relevant docs
3. Check `docs/features/feature-matrix.md` for phase placement — ensure the plan only includes Phase 1 features (Phase 2 and 3 only if explicitly asked)

After reading docs, produce a clear plan with:
- Files to create or modify (full paths)
- Module responsibilities (what each file does)
- Phase compliance check
- Prompt user to switch to build mode

## For build mode

After implementing a plan or making any code change, complete the full workflow:

0. **Issue tracking** — Before any code change, check if a GitHub Issue exists for this work. Use `gh issue list --search` to find matching issues by domain and title. If no open issue matches, delegate to `ticket-manager` with `/tickets find-or-create` to create one following the standard ticket body template. All work must be tracked against an issue number.
1. Delegate coding to specialists — `backend-builder` for backend, `frontend-builder` for frontend
2. After code is written, launch `convention-reviewer` to audit all changes against project conventions
3. After review, launch `test-author` to write or update tests
4. After tests, launch `docs-writer` to generate or update documentation
5. After each subagent completes, launch `ticket-manager` to update the corresponding GitHub Issue with status, files created, and comments
6. After all steps pass, stage only the changed files (`git add <paths>`) and commit using the git-workflow convention: `<type>(<scope>): <description>`. Then instruct `ticket-manager` to close the issue as Done.

**Never skip step 0, 2, 3, 4, 5, or 6.** They are part of the definition of "done."

## Project-wide rules

### Phase awareness
- Phase 1: public translation, free user auth, 8 formats, basic queue, rate limiting, admin bootstrap
- Phase 2: plans/billing, batch ops, glossaries, API keys, webhooks, teams, notifications, admin panel
- Phase 3: translation memory, scheduling, audit logs, custom roles — DO NOT build unless explicitly asked

### Backend rules
- Response envelope: every route uses `single_response()` or `paginated_response()` — never construct raw dicts
- Errors: always use `AppError` with standard codes from `docs/architecture/api-reference.md`
- Imports: absolute from `app.*` — never relative
- Schemas: request and response schemas are separate — never reuse one for the other
- Auth: every endpoint has an explicit dependency (get_current_user, get_optional_user, etc.)
- Async: all service functions are `async def` with explicit dependencies
- DTOs: use `@dataclass` for internal data transfer between service and controller — never pass raw dicts between layers
- Size limits: files ≤ 200 lines, functions ≤ 50 lines

### Frontend rules
- States: every page handles loading, empty, error, and edge cases — never leave one unhandled
- i18n: never hardcode English strings — all text through `t("namespace.key")`
- Colors: never use hex/rgb — always Tailwind semantic tokens
- Forms: always Zod schema + React Hook Form — no manual form state
- Components: check the shared component catalog before building — never rebuild existing components
- Routes: every new route must have the correct guard from `docs/frontend/routing.md`
- Size limits: files ≤ 200 lines, components ≤ 150 lines, hooks/utilities ≤ 50 lines

### Git rules
- Branch: `<type>/<yyyy-MM-dd>-<short-description>`
- Commit: `type(scope): description` with project scopes (auth, jobs, batches, teams, glossary, webhooks, billing, notifications, admin, frontend, docs, ci)
- Stage: Use `git add <specific paths>` — never `git add -A` to avoid accidentally committing secrets
- Never commit: `.env`, `node_modules/`, `__pycache__/`, `.DS_Store`, `dist/`, `build/`, `coverage/`
- Pre-commit: run linters before committing — no skipping
- Load `git-workflow` skill for complete git conventions

### General rules
- Before coding: read relevant docs from `docs/architecture/` or `docs/frontend/`
- After coding: run linters — `ruff check` + `mypy` for Python, `eslint` + `tsc --noEmit` for TypeScript
- Use the specialists — don't build backend or frontend code in the build agent directly
