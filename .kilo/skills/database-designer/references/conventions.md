# Project SQL Conventions & Templates

This document encodes the SQL patterns used throughout the document translation platform's PostgreSQL schema. Every new table you design must follow these patterns exactly — consistency across the schema is more important than personal preference.

The canonical source of truth for existing entities is `docs/architecture/system-design.md`. This document translates those conventions into reusable SQL templates.

---

## CREATE TYPE (Enum)

When a column has a fixed set of values, create a named enum type before the table:

```sql
CREATE TYPE {table}_{column}_enum AS ENUM ('VALUE1', 'VALUE2', 'VALUE3');
```

Example from the project:
```sql
CREATE TYPE job_status_enum AS ENUM (
    'queued', 'parsing', 'translating', 'rebuilding',
    'completed', 'failed', 'retrying'
);
```

Enum values should be:
- lowercase, snake_case
- Listed in logical order (lifecycle order for statuses)
- Created before the table that references them

---

## CREATE TABLE (Full Template)

```sql
CREATE TABLE {table_name} (
    {table_singular}_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    {fk_column}           UUID REFERENCES {parent_table}({parent_pk}) ON DELETE {CASCADE|SET NULL|RESTRICT},
    {text_column}         TEXT NOT NULL,
    {optional_text}       TEXT,
    {boolean_column}      BOOLEAN NOT NULL DEFAULT false,
    {integer_column}      INTEGER NOT NULL DEFAULT 0,
    {enum_column}         {enum_type_name} NOT NULL DEFAULT '{default_value}',
    {jsonb_column}        JSONB,
    {url_column}          TEXT,                              -- or VARCHAR(500) with CHECK
    {datetime_column}     TIMESTAMPTZ,
    {nullable_fk}         UUID REFERENCES {table}({pk}) ON DELETE SET NULL,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index on every FK column
CREATE INDEX ix_{table}_{fk_column} ON {table_name} ({fk_column});

-- Index on query filter columns
CREATE INDEX ix_{table}_{filter_column} ON {table_name} ({filter_column});

-- Composite index for multi-column queries
CREATE INDEX ix_{table}_{col1}_{col2} ON {table_name} ({col1}, {col2});
```

### Column Order Convention

List columns in this order:
1. Primary key (`{table_singular}_id`)
2. Foreign keys (parent references first)
3. Required scalar fields (NOT NULL text, integers, booleans)
4. Optional scalar fields (nullable text, integers)
5. Enum fields
6. JSONB / unstructured data
7. URL / path fields
8. Optional foreign keys (nullable references)
9. Timestamps (`created_at`, `updated_at`)

---

## Foreign Key Patterns

### Standard FK (inline in column definition)
```sql
user_id UUID REFERENCES users(user_id) ON DELETE CASCADE
```

### FK with NOT NULL (child can't exist without parent)
```sql
team_id UUID NOT NULL REFERENCES teams(team_id) ON DELETE CASCADE
```

### Optional FK (keeps record when parent deleted)
```sql
glossary_id UUID REFERENCES glossary(glossary_id) ON DELETE SET NULL
```

### Self-referential FK
```sql
parent_id UUID REFERENCES categories(category_id) ON DELETE SET NULL
```

---

## Index Patterns

### Single-column index (FK, filter column)
```sql
CREATE INDEX ix_{table}_{column} ON {table} ({column});
```

### Composite index (multi-column queries)
```sql
CREATE INDEX ix_{table}_{col1}_{col2} ON {table} ({col1}, {col2});
```

Order matters: put equality columns first, then range/sort columns.

### Unique index (business keys)
```sql
CREATE UNIQUE INDEX uq_{table}_{col1}_{col2} ON {table} ({col1}, {col2});
```
Or use an inline UNIQUE constraint — either is fine.

### Partial index (filtered subset)
```sql
CREATE INDEX ix_{table}_{column}_active ON {table} ({column}) WHERE {condition};
```

---

## Timestamp Conventions

Every table that tracks creation/modification time uses these two columns:

```sql
created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
```

- Use `TIMESTAMPTZ` (never `TIMESTAMP` / `timestamp without time zone`)
- `created_at` set once via DEFAULT
- `updated_at` must be updated by application code (or a trigger)
- Other timestamp columns (e.g., `expires_at`, `completed_at`, `started_at`) use `TIMESTAMPTZ` with no DEFAULT (NULL until the event occurs)

---

## Boolean Conventions

Every boolean column has an explicit default:

```sql
is_active  BOOLEAN NOT NULL DEFAULT true,
is_read    BOOLEAN NOT NULL DEFAULT false,
is_deleted BOOLEAN NOT NULL DEFAULT false
```

- Prefix with `is_` or `has_`
- Always `NOT NULL` — tri-state (true/false/NULL) is a source of bugs
- `DEFAULT false` for most flags; `DEFAULT true` for "active/enabled" flags

---

## Counter / Numeric Conventions

```sql
attempts             INTEGER NOT NULL DEFAULT 0,
max_attempts         INTEGER NOT NULL DEFAULT 3,
pages_consumed       INTEGER NOT NULL DEFAULT 0,
progress_pct         DOUBLE PRECISION NOT NULL DEFAULT 0.0,
price_monthly        NUMERIC(10,2)
```

- Counters: `INTEGER NOT NULL DEFAULT 0`
- Percentages: `DOUBLE PRECISION NOT NULL DEFAULT 0.0`
- Money: `NUMERIC(10,2)` — scale to business needs

---

## Alter Table Patterns

### Add a nullable column
```sql
ALTER TABLE {table} ADD COLUMN {column} {type};
```

### Add a NOT NULL column (with default, so existing rows get a value)
```sql
ALTER TABLE {table} ADD COLUMN {column} {type} NOT NULL DEFAULT {value};
```

### Add a foreign key column
```sql
ALTER TABLE {table} ADD COLUMN {column} UUID REFERENCES {parent}({pk}) ON DELETE SET NULL;
CREATE INDEX ix_{table}_{column} ON {table} ({column});
```

Always add an index on the new FK column immediately.

### Add an index
```sql
CREATE INDEX ix_{table}_{column} ON {table} ({column});
```

### Add a constraint
```sql
ALTER TABLE {table} ADD CONSTRAINT {name} CHECK ({condition});
ALTER TABLE {table} ADD CONSTRAINT {name} UNIQUE ({column});
```

---

## Real Project Examples

### users table (abridged)
```sql
CREATE TABLE users (
    user_id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email                  TEXT NOT NULL UNIQUE,
    name                   TEXT,
    password_hash          TEXT NOT NULL,
    role                   user_role_enum NOT NULL DEFAULT 'USER',
    is_verified            BOOLEAN NOT NULL DEFAULT false,
    is_active              BOOLEAN NOT NULL DEFAULT true,
    pages_used_this_month  INTEGER NOT NULL DEFAULT 0,
    billing_period_start   TIMESTAMPTZ,
    stripe_customer_id     TEXT,
    plan_id                UUID REFERENCES plans(plan_id),
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_users_role ON users (role);
CREATE INDEX ix_users_is_active ON users (is_active);
```

### jobs table (abridged)
```sql
CREATE TABLE jobs (
    job_id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id               UUID REFERENCES users(user_id) ON DELETE CASCADE,
    batch_id              UUID REFERENCES batches(batch_id) ON DELETE SET NULL,
    priority              INTEGER NOT NULL DEFAULT 0,
    status                job_status_enum NOT NULL DEFAULT 'queued',
    attempts              INTEGER NOT NULL DEFAULT 0,
    max_attempts          INTEGER NOT NULL DEFAULT 3,
    source_lang           TEXT NOT NULL,
    target_lang           TEXT NOT NULL,
    provider_id           UUID REFERENCES providers(provider_id),
    glossary_id           UUID REFERENCES glossary(glossary_id) ON DELETE SET NULL,
    original_filename     TEXT NOT NULL,
    original_file_path    TEXT NOT NULL,
    translated_file_path  TEXT,
    download_url_expires_at  TIMESTAMPTZ,
    pages_consumed        INTEGER NOT NULL DEFAULT 0,
    progress_pct          DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    current_stage         TEXT,
    error_message         TEXT,
    preview_segments      JSONB,
    callback_url          TEXT,
    queued_at             TIMESTAMPTZ,
    started_at            TIMESTAMPTZ,
    completed_at          TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_jobs_user_id ON jobs (user_id);
CREATE INDEX ix_jobs_status ON jobs (status);
CREATE INDEX ix_jobs_batch_id ON jobs (batch_id);
CREATE INDEX ix_jobs_created_at ON jobs (created_at);
```

### team_members (junction table)
```sql
CREATE TABLE team_members (
    team_member_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id         UUID NOT NULL REFERENCES teams(team_id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    role            team_member_role_enum NOT NULL DEFAULT 'MEMBER',
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (team_id, user_id)
);

CREATE INDEX ix_team_members_team_id ON team_members (team_id);
CREATE INDEX ix_team_members_user_id ON team_members (user_id);
```

Key patterns visible here:
- Composite UNIQUE constraint on `(team_id, user_id)` — a user can only be a member once per team
- Separate `team_member_id` PK even though `(team_id, user_id)` is unique — gives a stable reference point
- Both FK columns indexed
