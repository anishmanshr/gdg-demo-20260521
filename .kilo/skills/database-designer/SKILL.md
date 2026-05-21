---
name: database-designer
description: Design PostgreSQL database schemas in raw SQL. Use this skill whenever the user asks to design a database, create a schema, add tables, define entities, normalize data, write DDL, create indexes, design relationships, or model a database. Even if the user says "I need a table for X", "design the schema for Y", "how should I structure this database", or mentions entities, columns, foreign keys, or CREATE TABLE — use this skill.
---

# Database Designer

Design PostgreSQL database schemas using raw SQL DDL. This skill encodes project conventions, industry best practices, and common anti-patterns — so every schema produced is consistent, performant, and production-ready.

**Always read `references/conventions.md` after this file** — it contains the project's SQL templates and naming patterns that every design must follow.

**Read `references/best-practices.md` when** you need guidance on data type selection, index strategy, or normalization tradeoffs.

**Read `references/anti-patterns.md` when** you're unsure if an approach is sound — it lists what to avoid and why.

---

## Quick Reference: Which Doc to Read

| You're doing... | Read this |
|---|---|
| Designing a new table from scratch | `references/conventions.md` — copy the template |
| Deciding INTEGER vs UUID vs BIGINT for PK | `references/best-practices.md` — Primary Keys section |
| Deciding TEXT vs VARCHAR(n) | `references/anti-patterns.md` — Text Storage section |
| Choosing timestamp type | `references/anti-patterns.md` — Date/Time Storage section |
| Figuring out which indexes to add | `references/best-practices.md` — Indexing Strategy section |
| Checking if you violated a best practice | `references/anti-patterns.md` — scan all sections |
| Understanding the existing schema | `docs/architecture/system-design.md` — all entities |
| Checking if a feature is in scope | `docs/features/feature-matrix.md` — phase awareness |
| Understanding how entities relate | `docs/architecture/system-design.md` — FK cascade rules |

---

## Design Workflow

Follow this sequence when designing a database schema. Don't skip steps.

### 1. Understand the Existing Schema

Read `docs/architecture/system-design.md` to see what entities already exist, what cascade rules are in place, and what the indexing strategy looks like. A new table must fit into this landscape — reusing existing columns, FK relationships, and naming patterns.

### 2. Understand the Feature Requirements

Identify:
- What data needs to be stored (entities)
- How entities relate (1:1, 1:N, M:N)
- What queries will be run against this data (determines indexes)
- What the data lifecycle looks like (soft delete? archival? partitioning?)

### 3. Identify Entities and Relationships

List every entity as a table. For each relationship:
- **1:N** → FK on the "many" side referencing the "one" side
- **M:N** → Junction table with two FKs and a composite primary key
- **1:1** → FK with UNIQUE constraint on the referencing column

### 4. Apply Normalization

Target 3NF (Third Normal Form):
- **1NF**: Every column contains atomic values. No repeating groups. No arrays stored as comma-separated strings (use JSONB or a child table instead).
- **2NF**: Every non-key column depends on the whole primary key, not just part of it. (Only relevant for composite keys.)
- **3NF**: Every non-key column depends on the primary key and nothing else. No transitive dependencies (if A → B and B → C, split out B → C into its own table).

Denormalize only when:
- You have a read-heavy workload where JOINs are the bottleneck
- You've measured the performance impact and the tradeoff is worth it
- You understand the data consistency risks

### 5. Produce DDL

Output raw SQL DDL statements in this order:
1. `CREATE TYPE ... AS ENUM` (if any enum columns)
2. `CREATE TABLE` with all columns, constraints, and inline indexes
3. `CREATE INDEX` for any additional indexes not created inline
4. `ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY` (if not inline)
5. `COMMENT ON ...` for key design decisions

### 6. Verify Against Conventions

Before presenting the output, check:
- [ ] All table names are plural and **snake_case**
- [ ] All column names are **snake_case**
- [ ] PK columns named `{table_singular}_id` (e.g., `user_id`, not `id`)
- [ ] FK column names match the PK they reference
- [ ] Every table uses `UUID` PKs with `gen_random_uuid()` default
- [ ] Every table has `created_at` and `updated_at` as `TIMESTAMPTZ`
- [ ] All time columns use `TIMESTAMPTZ` (never `TIMESTAMP`)
- [ ] Text columns use `TEXT` (not `VARCHAR(n)` unless length is a real business constraint)
- [ ] Every FK has an explicit `ON DELETE` behavior
- [ ] All FK columns have indexes
- [ ] Query filter columns have indexes
- [ ] Status/type columns use ENUM types
- [ ] No `CHAR(n)`, `MONEY`, `SERIAL`, or upper-case identifiers

---

## Naming Conventions

Every design must follow these precisely. They exist so the schema is self-documenting and mistakes are visible at a glance.

### Tables
- **Plural, snake_case**: `users`, `jobs`, `team_members`, `webhook_deliveries`
- No prefix like `tbl_` or `t_`
- Junction tables: `{table1}_{table2}` (e.g., `plan_provider_mappings`)

### Columns
- **snake_case**: `original_filename`, `pages_used_this_month`
- Boolean columns: `is_active`, `is_verified`, `is_read`
- Timestamp columns: `created_at`, `completed_at`, `expires_at`
- Count/aggregate columns: `attempts`, `total_files`, `pages_consumed`

### Primary Keys
- **`{table_singular}_id`**: `user_id`, `job_id`, `batch_id`, `team_id`
- Never just `id` — using descriptive names prevents join bugs where you accidentally compare wrong columns (e.g., `jobs.user_id = teams.user_id` is clearly suspicious; `jobs.id = teams.id` isn't).

### Foreign Keys
- Name the FK column identically to the PK it references: `user_id` FK → references `users.user_id`
- When a table has multiple FKs to the same parent, prefix for clarity: `invited_by_user_id`, `approved_by_user_id`

### Indexes
- **`ix_{table}_{column}`**: `ix_jobs_user_id`, `ix_notifications_user_id_created_at`
- For composite indexes, join column names with underscore
- Unique indexes: `uq_{table}_{column}` or let the UNIQUE constraint auto-name it

### ENUM Types
- **`{table}_{column}_enum`**: `job_status_enum`, `team_member_role_enum`
- Always create as standalone `CREATE TYPE` before the table that uses them

### Constraints
- Explicit names for clarity: `positive_price`, `valid_discount`, `must_be_different`
- System-generated names are fine for simple NOT NULL / PK constraints

---

## Data Type Selection

| Use Case | Type | Rationale |
|---|---|---|
| Primary key | `UUID` with `DEFAULT gen_random_uuid()` | No collision risk, no information leakage, project convention |
| Foreign key | `UUID` (matching the PK type) | Must match referenced column type exactly |
| Identifier from external system | `TEXT` with CHECK constraint | e.g., `stripe_customer_id`, `stripe_subscription_id` |
| Variable-length text | `TEXT` | No arbitrary limit; use CHECK for business rules |
| Fixed-length text | `TEXT` with `CHECK(LENGTH(col) = N)` | `CHAR(n)` silently pads with spaces — avoid |
| Timestamp (point in time) | `TIMESTAMPTZ` | Stores UTC internally; always the right choice |
| Boolean flag | `BOOLEAN` with `DEFAULT false` | Clear, indexable, no null ambiguity |
| Status / Type | Custom `ENUM` type | Data integrity at the DB level; use `CREATE TYPE ... AS ENUM` |
| Money / price | `NUMERIC(10,2)` or `INTEGER` (cents) | `MONEY` type is locale-dependent — avoid |
| Counter / integer | `INTEGER` (or `BIGINT` for large counts) | Use `NOT NULL DEFAULT 0` |
| Floating point | `DOUBLE PRECISION` or `NUMERIC` | `NUMERIC` for exact decimal; `DOUBLE PRECISION` for ratios/percents |
| Unstructured / flexible data | `JSONB` | Indexable, queryable; prefer structured columns when schema is known |
| File path / URL | `TEXT` or `VARCHAR(500)` | Reasonable length limit here is OK; check constraints validate format |
| IP address | `INET` | Native PostgreSQL type, better than TEXT |
| Email | `TEXT` with UNIQUE constraint | Add CHECK for basic format validation |

---

## Constraints

Apply constraints at the database level — not just in application code. The database is the last line of defense.

### NOT NULL
Most columns should be `NOT NULL`. Only allow NULL when the value is truly optional or unknown at creation time. The PostgreSQL wiki recommends: "In most database designs the majority of columns should be marked not null."

### CHECK
Use CHECK constraints for domain validation:
```sql
CHECK (price > 0)
CHECK (LENGTH(email) BETWEEN 5 AND 255)
CHECK (role IN ('OWNER', 'ADMIN', 'MEMBER'))
```

### UNIQUE
Use UNIQUE constraints on natural business keys:
- `email` in `users`
- `team_id, user_id` in `team_members` (composite)
- `token` in `team_invitations`

UNIQUE creates a B-tree index automatically.

### FOREIGN KEY
Every FK must have an explicit `ON DELETE` action. The decision tree:

| Relationship | ON DELETE | Example |
|---|---|---|
| Child can't exist without parent | `CASCADE` | `users` → `jobs`, `teams` → `team_members` |
| Independent entities | `RESTRICT` | `plans` → `subscriptions` |
| Optional reference, keep record | `SET NULL` | `users` → `jobs` (public jobs survive) |
| Optional reference, anonymize | `SET NULL` | `users` → `team_invitations.invited_by` |

### Exclusion Constraints
Use when you need more than simple uniqueness — e.g., preventing overlapping date ranges or geometric overlaps:
```sql
EXCLUDE USING gist (valid_at WITH &&)
```

---

## Index Strategy

Indexes make queries fast but slow down writes. Be deliberate.

### Always Index
- **Primary key columns** — PostgreSQL does this automatically
- **Foreign key columns** — speeds up JOINs and prevents sequential scans on DELETE/UPDATE of parent
- **Columns used in WHERE clauses** — especially for frequently filtered queries
- **Columns used in ORDER BY** — when combined with WHERE on the same column
- **UNIQUE constraint columns** — PostgreSQL does this automatically

### Consider Indexing
- **Composite indexes** for multi-column WHERE clauses: `CREATE INDEX ix_orders_user_status ON orders (user_id, status)`
- **Partial indexes** when filtering a common subset: `CREATE INDEX ix_jobs_active ON jobs (user_id) WHERE status NOT IN ('completed', 'failed')`
- **Covering indexes** (INCLUDE) when index-only scans would help: `CREATE INDEX ix_users_email ON users (email) INCLUDE (name, role)`

### Don't Index
- **Low-cardinality columns** alone (e.g., `is_active` with 99% true — but OK as part of a composite index)
- **Columns never used in WHERE, JOIN, or ORDER BY**
- **Very wide columns** (TEXT, JSONB) — index only if you query them directly with equality

### Index Type Selection
- **B-tree (default)**: Equality, range, sorting. Covers 95% of cases.
- **GIN**: Full-text search, JSONB containment (`@>`), array containment
- **GiST**: Geometric data, range exclusion constraints, full-text
- **BRIN**: Very large tables with natural sort order (e.g., time-series by `created_at`)

Index naming follows the convention: `ix_{table}_{column}`.

---

## PostgreSQL Anti-Patterns at a Glance

From the PostgreSQL wiki "Don't Do This" and real-world experience:

| Anti-Pattern | Why | Fix |
|---|---|---|
| `CHAR(n)` | Silently pads with spaces, no performance benefit | `TEXT` with CHECK |
| `VARCHAR(255)` | Arbitrary limit with no business meaning | `TEXT` |
| `TIMESTAMP` (without tz) | Doesn't store a point in time, just a clock picture | `TIMESTAMPTZ` |
| `MONEY` | Locale-dependent, no fractional cents | `NUMERIC(10,2)` |
| `SERIAL` | Legacy, weird permission/sequence behavior | `UUID` with `gen_random_uuid()` or `GENERATED AS IDENTITY` |
| Upper-case names | PostgreSQL folds to lower case, causes quoting hell | `snake_case` |
| Missing FK indexes | Sequential scans on parent DELETE/UPDATE | Index every FK column |
| `BETWEEN` with timestamps | Includes boundary exactly, double-counts midnight | `>= ... AND < ...` |

Full details in `references/anti-patterns.md`.

---

## Output Format

Always output **raw SQL DDL**. Never output ORM code (no SQLAlchemy, no Python, no TypeScript models).

Present tables in dependency order (parent tables first, child tables that reference them second). Group related DDL together:

```sql
-- ============================================================
-- audit_logs — Tracks all administrative and system actions
-- ============================================================

CREATE TYPE audit_action_enum AS ENUM (
    'user_created', 'user_deleted', 'plan_changed', 'provider_updated'
);

CREATE TABLE audit_logs (
    audit_log_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id       UUID REFERENCES users(user_id) ON DELETE SET NULL,
    action         audit_action_enum NOT NULL,
    target_type    TEXT NOT NULL,
    target_id      UUID,
    details        JSONB,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_audit_logs_actor_id ON audit_logs (actor_id);
CREATE INDEX ix_audit_logs_action ON audit_logs (action);
CREATE INDEX ix_audit_logs_target ON audit_logs (target_type, target_id);
```

For schema alterations, output `ALTER TABLE` statements:
```sql
ALTER TABLE jobs ADD COLUMN glossary_id UUID REFERENCES glossary(glossary_id) ON DELETE SET NULL;
CREATE INDEX ix_jobs_glossary_id ON jobs (glossary_id);
```

---

## Phase Awareness

This project has three phases defined in `docs/features/feature-matrix.md`:

- **Phase 1** (MVP): Public translation, auth, 8 formats, basic queue, rate limiting, admin bootstrap
- **Phase 2**: Plans/billing, batch ops, glossaries, API keys, webhooks, teams, notifications
- **Phase 3**: Translation memory, scheduling, audit logs, custom roles — **do not design unless explicitly asked**

Check the feature matrix before designing a table for a feature. If the feature isn't in Phase 1, confirm with the user before proceeding.

---

## Quick Checklist

Before finalizing any schema design, verify every item:

```
[ ] Table name is plural and snake_case
[ ] PK column is {table_singular}_id, UUID with gen_random_uuid()
[ ] created_at and updated_at are TIMESTAMPTZ
[ ] All timestamp columns are TIMESTAMPTZ (never TIMESTAMP)
[ ] Text columns use TEXT (not VARCHAR(n) unless length is a real business rule)
[ ] Every FK has explicit ON DELETE behavior
[ ] Every FK column has an index
[ ] Status/type columns use ENUM types
[ ] Boolean columns use BOOLEAN with explicit DEFAULT
[ ] Money uses NUMERIC (not MONEY)
[ ] No CHAR(n), no SERIAL, no upper-case identifiers
[ ] Composite UNIQUE constraints where business rules require them
[ ] CHECK constraints for domain validation beyond type checking
[ ] Indexes exist for all columns in WHERE, JOIN, and ORDER BY clauses
[ ] Normalized to 3NF unless deliberate denormalization with documented reason
[ ] Feature is in-scope for the current phase
```
