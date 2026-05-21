---
name: docs-generator
description: Generate and update project documentation (architecture docs, API references, feature matrices, frontend page specs, user guides) for the document translation platform. Use this skill whenever code has been built or changed and documentation needs to be created or updated. Also use when the user asks to generate docs, update docs, write documentation, document a feature, create a user manual, or sync docs with code.
---

# Documentation Generator

This skill governs how project documentation is created, updated, and maintained. Documentation lives in `docs/` and follows strict conventions that match the existing docs. Never invent your own doc format — always match what's there.

## Document Types and Locations

| Type | Directory | When to create/update |
|---|---|---|
| Architecture docs | `docs/architecture/` | New backend module, new pattern, infra change, security change |
| Feature docs | `docs/features/` | New feature, updated feature matrix |
| Frontend page specs | `docs/frontend/{section}/` | New page, page redesign |
| User guide | `docs/guides/user-manual.md` | Any user-facing feature or flow |
| API reference | `docs/architecture/api-reference.md` | Any endpoint change |
| System design | `docs/architecture/system-design.md` | Any model change |

## Document Templates

### Architecture Doc Template
```markdown
# Title
## Overview / Purpose
## Architecture (diagram or description)
## Entities (if applicable — table with columns, types, constraints)
## API / Interface (if applicable)
## Security (if applicable)
## Testing Notes (if applicable)
```

### Frontend Page Doc Template
```markdown
# Page Name
## Route
## Purpose
## Components Used
## States (Loading, Empty, Error, Edge cases)
## User Flow
## Key Interactions
```

### Feature Doc Template
```markdown
# Feature Name
## Purpose
## User Flow
## Business Rules
## Limitations / Constraints
## Phase
```

## Diagram Format

Use ASCII/Unicode box-drawing in code blocks for simple diagrams. Do not reference external drawing tools. Match the style used in existing docs (e.g., `docs/architecture/overview.md`, `docs/architecture/system-design.md`).

For component diagrams:
```text
┌──────────┐     ┌──────────┐
│  Module  │────▶│  Module  │
└──────────┘     └──────────┘
```

For flow diagrams:
```text
STEP 1 → STEP 2 → STEP 3
   │                  │
   ▼                  ▼
 ERROR             SUCCESS
```

For tables, always use GitHub-flavored markdown tables with aligned columns. Include a header row and divider.

## Cross-Referencing

- Link between docs using relative paths: `[See API Reference](../api-reference.md)`
- When you add a new endpoint to `api-reference.md`, also check if `feature-matrix.md` needs updating
- When you add a new model, update both `system-design.md` (entity) and `modular-design.md` (directory structure)
- Update the quick-reference tables in skill files (`.agents/skills/*/SKILL.md`) if new doc files are created

## User Manual Conventions

Create `docs/guides/user-manual.md` that covers:
1. **Getting Started** — how to sign up, first translation
2. **Features** — each user-facing feature with screenshots described in text
3. **Plans & Billing** — pricing, upgrading, canceling
4. **Teams** — creating, inviting, managing
5. **API Access** — generating keys, using the API
6. **Troubleshooting** — common issues, error messages, solutions

Write from the user's perspective. Use simple language. Describe what the user sees and does. Do not describe implementation details.

## Generation Workflow

When code has been built or changed:

1. **Read the code** — Understand what was built. Read the actual files that changed.
2. **Read existing docs** — Understand the current doc structure and writing style.
3. **Identify affected docs** — Which doc types from the table above are impacted?
4. **Write/update docs** — Create new doc files or edit existing ones. Match the existing style, tone, and format.
5. **Update cross-references** — Ensure all links between docs are correct.
6. **Update quick-reference tables** — If new doc files were added, update the reference tables in `fastapi-backend/SKILL.md` and `frontend-app/SKILL.md`.

## Writing Style

- Imperative tone: "The system validates..." not "The system should validate..."
- Tables over paragraphs when listing structured data
- Code blocks over inline code for multi-line snippets
- Full language names in code blocks: ```python not ```py
- One sentence per line in markdown source (makes diffs readable)
- Never use emojis
- Never use "TODO" or "TBD" — if information is unknown, describe what IS known and note what needs verification

## Phase Tracking

Update `docs/features/feature-matrix.md` as features progress:
- Mark completed items with `[x]` in the feature table
- Add a date of completion next to newly completed items
- If a feature is partially done, note what's done and what's remaining
- The feature matrix is the project's progress tracker — keep it accurate
