---
name: project-management
description: Manage GitHub Issues as Jira-like tickets for the document translation platform. Use this skill whenever the user asks to create tasks, generate tickets, bootstrap a backlog, update ticket status, track progress, or manage the project board. Also use when features are built and tickets need status updates. This skill encodes the ticket naming conventions, task breakdown rules, status lifecycle, and GitHub Issues API patterns.
---

# Project Management

This skill governs how project work is tracked via GitHub Issues. Tasks are auto-generated from `docs/features/feature-matrix.md` and auto-updated by agents as they complete work.

## Ticket Structure

### Epic
Each feature in the feature matrix becomes an **epic** issue with the `epic` label.
```
Title: [Phase 1] Public Translation
Labels: epic, phase:1
```

### Child Tasks
Every epic breaks down into these standard tasks:

| Task | Labels | Assigns to |
|---|---|---|
| Models + migration | backend, phase:X | backend-builder |
| Service layer | backend, phase:X | backend-builder |
| API route(s) | backend, phase:X | backend-builder |
| Frontend page(s) + states | frontend, phase:X | frontend-builder |
| Integration tests | test, phase:X | test-author |
| E2E test | test, e2e, phase:X | test-author |
| Documentation | docs, phase:X | docs-writer |

If a feature is backend-only, skip frontend tasks. If frontend-only, skip backend tasks.

### Naming Convention
```
[Phase N] [Domain] [Description]
```

Examples:
```
[Phase 1] [Auth] Implement JWT login endpoint
[Phase 1] [Jobs] Build SSE progress stream for translation jobs
[Phase 1] [Frontend] Public home page with drop zone and language selector
[Phase 1] [Docs] Update API reference with auth endpoints
```

### Labels
| Label | Color | Meaning |
|---|---|---|
| `epic` | `#7C3AED` | Parent issue tracking a feature |
| `backend` | `#2563EB` | Backend work |
| `frontend` | `#059669` | Frontend work |
| `test` | `#D97706` | Testing work |
| `e2e` | `#DC2626` | End-to-end testing |
| `docs` | `#0891B2` | Documentation work |
| `phase:1` | `#6B7280` | Phase 1 (MVP) |
| `phase:2` | `#6B7280` | Phase 2 |
| `phase:3` | `#6B7280` | Phase 3 — do not build |
| `needs-fix` | `#DC2626` | Convention review found errors |

## Status Lifecycle

```
Backlog → In Progress → Review → Testing → Done
   ↑         │            │         │        │
   └─────────┴────────────┴─────────┘        │
        (failed review or failed tests)       │
                                             ✓
```

| Status | Trigger |
|---|---|
| `Backlog` | Initial state. Ticket created but no work started. |
| `In Progress` | Plan produced by plan agent. Work delegated. |
| `Review` | All code complete. convention-reviewer audit pending. |
| `Testing` | Review passed (0 errors). test-author running. |
| `Done` | Tests pass + docs updated. Issue closed. |

If review finds errors → add `needs-fix` label, move back to `In Progress`.
If tests fail → move back to `In Progress`.

## GitHub Issues API Patterns

For all GitHub API calls, use the `gh` CLI via bash (GitHub MCP is available but `gh` is more reliable for issue management):

### List open issues
```bash
gh issue list --repo owner/repo --label "phase:1" --state open --json number,title,labels,state --jq '.[] | "\(.number): \(.title)"'
```

### Create issue
```bash
gh issue create --repo owner/repo --title "[Phase 1] [Auth] Implement JWT login" --label "backend,phase:1" --body "## Description
Implement JWT login endpoint.

## Acceptance Criteria
- [ ] POST /api/v1/auth/login returns access token
- [ ] Refresh token in httpOnly cookie
- [ ] Invalid credentials return 401 with standard error envelope
- [ ] Integration tests cover success, invalid creds, missing fields

**Epic:** #[epic-number]"
```

### Add comment to issue
```bash
gh issue comment <number> --repo owner/repo --body "## Backend Complete
- api/v1/auth.py: login, refresh, logout routes
- modules/auth/service.py: authentication logic
- schemas/auth.py: LoginRequest, TokenResponse
- tests/integration/test_auth.py: 8 tests passing"
```

### Close issue
```bash
gh issue close <number> --repo owner/repo --comment "## Done
All acceptance criteria met. Documentation updated."
```

### Move status (add/remove labels)
```bash
# Move to Review
gh issue edit <number> --repo owner/repo --remove-label "In Progress" --add-label "Review"
```

### Get issue details
```bash
gh issue view <number> --repo owner/repo --json number,title,state,labels,body
```

### Link child to epic
Put `Closes #` or `Parent: #` in the child issue body. GitHub auto-links.

---

## Ticket Body Template

Every issue must follow this structure. Child tasks link to their parent epic. Epics describe the full feature scope.

### Epic Body

```
## Description
<2-3 sentences describing the feature and its purpose>

## Scope
- <concrete deliverable>
- <concrete deliverable>
- <concrete deliverable>

## Acceptance Criteria
- [ ] <cross-cutting testable criterion>
- [ ] <cross-cutting testable criterion>
```

### Child Task Body

```
## Description
<1-2 sentences describing what this task builds>

## Tasks / Scope
- <concrete file or behavior>
- <concrete file or behavior>

## Acceptance Criteria
- [ ] <testable criterion with specific endpoint, status code, or behavior>
- [ ] <testable criterion>

**Parent:** #[epic-number]
```

### Body Rules
- Descriptions are imperative, present tense.
- Scope lists concrete deliverable items, not abstract concepts.
- Acceptance criteria are testable: specific endpoints, status codes, file paths, or behaviors.
- Always include `**Parent:** #[epic-number]` in child task bodies.
- Use code blocks for endpoints, commands, and JSON examples.
- Never use emojis or vague language like "should work" or "TBD."

---

## Find or Create

Before creating any issue, always search for an existing match:

```bash
gh issue list --repo owner/repo --search "<keyword> in:title" --state open --json number,title
```

If a matching issue exists, use it. If not, create a new one following the body template above.

---

## Bootstrap: Generate Tickets from Docs

`/tickets bootstrap` triggers this workflow:

### Step 1: Read feature-matrix.md
Identify Phase 1 features. For each feature not yet `[x]`:

### Step 2: Generate epics
For each unscoped feature, create an epic issue. Use the feature name from the matrix.

### Step 3: Generate child tasks
For each epic, create 5-7 child tasks following the standard breakdown above.
Refer back to the parent epic: `Parent: #[epic-number]` in each child.

### Step 4: Report
Return a summary table:
```
| Epic | Tasks | Phase |
|---|---|---|
| Public Translation | 7 | 1 |
| User Auth | 6 | 1 |
| Admin Bootstrap | 4 | 1 |
| Event Bus | 3 | 1 |
| ... | ... | ... |

Total: N epics, M tasks. Created in <repo>.
```

### Step 5: Update feature-matrix.md
Mark bootstrapped features with a `[ ]` (checkbox) if not already present.

---

## Ticket Updates During Build

When the build agent delegates work and subagents complete, each agent reports to ticket-manager:

```
backend-builder done → ticket-manager: "comment on #12: backend code complete"
convention-reviewer done → ticket-manager: "comment on #12: review passed (0 errors)"
test-author done → ticket-manager: "comment on #12: 8 tests passing"
docs-writer done → ticket-manager: "close #12: documentation updated"
```

The ticket-manager agent:
1. Reads the current issue state
2. Updates labels to reflect new status
3. Adds a comment summarizing what was done
4. If all child tasks are Done → close the parent epic

---

## Resolving the Repo Name

When calling `gh issue`, use the repo from the current directory:
```bash
gh issue create --repo $(git remote get-url origin | sed 's/.*github.com[:/]\(.*\)\.git/\1/') --title "..."
```

Or let the agent auto-detect: `gh issue list` (no --repo flag) uses the current repo.
