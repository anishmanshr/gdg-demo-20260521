---
name: git-workflow
description: Enforce git conventions for the document translation platform. Use this skill whenever making commits, creating branches, opening pull requests, pushing code, or performing any git operation. Also use when the user mentions commit, push, PR, pull request, branch, or asks to save or version their changes.
---

# Git Workflow

This skill encodes the project's git conventions. Every commit, branch, and PR follows these rules. Deviations break CI/CD and make history unreadable.

## Branch Naming

Every branch follows this format:

```
<type>/<yyyy-MM-dd>-<short-description>
```

**Types:**

| Prefix | When to use |
|---|---|
| `feature/` | New functionality (endpoints, pages, components, modules) |
| `fix/` | Bug fixes |
| `refactor/` | Code restructuring without behavior change |
| `chore/` | Tooling, deps, config, build |
| `docs/` | Documentation only |
| `test/` | Tests only |
| `ci/` | CI/CD pipeline changes |

**Rules:**
- Date is the branch creation date in `yyyy-MM-dd` format (e.g., `2026-05-16`)
- Description is short, kebab-case, no more than 5 words
- Use only lowercase letters, numbers, and hyphens

**Examples:**
```
feature/2026-05-16-add-auth-endpoints
feature/2026-05-20-job-status-sse-stream
fix/2026-05-16-rate-limit-headers
fix/2026-05-18-fix-public-translation-quota
refactor/2026-05-16-extract-event-bus
chore/2026-05-16-upgrade-fastapi
docs/2026-05-16-api-reference-update
test/2026-05-16-integration-tests-auth
ci/2026-05-16-add-mypy-check
```

---

## Commit Messages

### Format

```
<type>(<scope>): <description>
```

### Types

| Type | When to use |
|---|---|
| `feat` | New feature or endpoint |
| `fix` | Bug fix |
| `refactor` | Code restructuring, no behavior change |
| `docs` | Documentation only |
| `chore` | Tooling, deps, config |
| `test` | Adding or updating tests |
| `style` | Formatting, whitespace, no code change |

### Scopes

Use the domain name from this project:

| Scope | Covers |
|---|---|
| `auth` | Authentication, JWT, OAuth, API keys, sessions |
| `jobs` | Translation jobs, pipeline, SSE progress, file processing |
| `batches` | Batch operations, bulk upload, zip download |
| `teams` | Team CRUD, members, invitations, RBAC |
| `glossary` | Glossary CRUD, terms, import/export |
| `webhooks` | Webhook CRUD, delivery, HMAC signing |
| `billing` | Stripe integration, subscriptions, plans, invoices |
| `notifications` | In-app notifications, email, SSE, preferences |
| `admin` | Admin panel, providers, plans, users, analytics |
| `frontend` | React app, pages, components, routing |
| `docs` | Architecture docs, feature docs |
| `ci` | CI pipeline, Docker, deployment |

### Examples

```
feat(auth): implement JWT login and refresh token flow
feat(jobs): add SSE endpoint for real-time translation progress
feat(billing): integrate Stripe Checkout for plan upgrades
fix(auth): return 401 instead of 500 on expired token
fix(jobs): correct page counting for PPTX slide-based format
refactor(webhooks): extract HMAC signing to shared utility
test(auth): add integration tests for signup and login flow
chore(ci): add mypy type checking to CI pipeline
docs(api): document pagination parameters across all endpoints
```

---

## What to Commit

### Always commit

| Files | Reason |
|---|---|
| `.agents/skills/**` | Shared agent skills |
| `skills-lock.json` | Skill registry |
| `docs/**` | Project documentation |
| `backend/**/*.py` | Application code |
| `frontend/src/**` | Application code |
| `frontend/public/locales/**` | i18n translation files |
| `requirements.txt`, `pyproject.toml` | Python dependencies |
| `package.json`, `package-lock.json` | Node dependencies |
| `docker-compose*.yml`, `Dockerfile` | Container config |
| `alembic/versions/*.py` | Database migrations |

### Never commit

| Files | Reason |
|---|---|
| `.env`, `.env.local`, `*.env` | Secrets |
| `node_modules/` | Dependency install |
| `__pycache__/`, `*.pyc` | Python bytecode |
| `.opencode/node_modules/` | Tooling deps |
| `*.log` | Log files |
| `.DS_Store` | OS files |
| `dist/`, `build/`, `.next/` | Build output |
| `coverage/`, `htmlcov/` | Coverage reports |
| `.pytest_cache/`, `.tox/` | Test artifacts |

If you accidentally stage a forbidden file, unstage it before committing:
```bash
git reset HEAD <file>
```

---

## Pre-Commit Validation

Before committing, run these checks. If any fail, fix the issues first — do not skip or force the commit.

**Backend (if Python files changed):**
```bash
ruff check backend/
mypy backend/
```

**Frontend (if TypeScript/JSX files changed):**
```bash
npm run lint --prefix frontend
npm run typecheck --prefix frontend
# or: npx tsc --noEmit
```

If a project-level lint or typecheck script exists (check `package.json` scripts or `Makefile`), use that instead.

---

## Creating a Pull Request

### Before opening a PR

1. Verify all pre-commit checks pass
2. Check `git status` — no unintended files
3. Run `git diff origin/main...HEAD` to review all changes
4. Confirm the branch is pushed with `git push -u origin <branch-name>`

### PR template

Use `gh pr create` with a heredoc body:

```bash
gh pr create --title "<type>(<scope>): <description>" --body "$(cat <<'EOF'
## Summary
- <bullet point 1>
- <bullet point 2>

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manually verified
EOF
)"
```

The title must match the conventional commit format used in commit messages.

---

## CI/CD Pipeline

After pushing, the pipeline runs these stages (see `docs/architecture/deployment.md`):

```
1. Lint & Type Check — ruff, mypy, eslint, tsc
2. Unit Tests — pytest, vitest
3. Build — Docker images
4. Deploy to Staging (main branch only)
5. Integration Tests — against staging DB
6. E2E Tests — Playwright
7. Manual Approval
8. Deploy to Production (rolling update)
```

Feature branch PRs trigger stages 1-3. Merges to main trigger the full pipeline.

---

## Git Safety Rules

These rules protect the repository. Never violate them unless the user explicitly asks.

| Rule | Why |
|---|---|
| Never force push to `main` or `master` | Destroys shared history |
| Never use `--no-verify` to skip hooks | Hooks catch real problems |
| Never amend a commit that's been pushed | Rewrites shared history |
| Never rebase pushed commits | Causes conflicts for others |
| Never run `git push --force` without confirmation | Should always be a conscious choice |
| Never update `git config` | Project settings, not yours to change |

### When amending IS okay

Only amend the most recent commit when ALL of:
1. The commit was created by you in this session
2. The commit has NOT been pushed to remote
3. You need to include files modified by a pre-commit hook

Verify with: `git log -1 --format='%an %ae'` and `git status` (must show "Your branch is ahead").

---

## Common Workflows

### Starting new work
```bash
git checkout main
git pull
git checkout -b feature/$(date +%Y-%m-%d)-add-job-endpoints
```

### Committing
```bash
git add -A
git status                    # Review what's staged
git reset HEAD <file>         # Remove forbidden files
git commit -m "feat(jobs): add list and detail endpoints"
```

### Pushing and opening a PR
```bash
git push -u origin feature/2026-05-16-add-job-endpoints
gh pr create --title "feat(jobs): add list and detail endpoints" --body ...
```
