# Database Design Best Practices

Synthesized from PostgreSQL official documentation, community resources, and industry experience. When in doubt, the PostgreSQL manual (`postgresql.org/docs/current/`) is the final authority.

---

## Table of Contents

1. [Primary Key Selection](#primary-key-selection)
2. [Data Type Selection](#data-type-selection)
3. [Text Storage](#text-storage)
4. [Date/Time Storage](#datetime-storage)
5. [Constraint Strategy](#constraint-strategy)
6. [Indexing Strategy](#indexing-strategy)
7. [Normalization](#normalization)
8. [PostgreSQL-Specific Features](#postgresql-specific-features)

---

## Primary Key Selection

### UUID (Recommended for this project)

The project uses UUIDs universally. This is the right choice when:
- Rows are created across multiple servers/regions (no central sequence)
- You want to avoid information leakage (sequential IDs reveal row count)
- You need globally unique identifiers across tables/systems

Use `gen_random_uuid()` (from `pgcrypto` extension, available by default in PostgreSQL 13+):
```sql
user_id UUID PRIMARY KEY DEFAULT gen_random_uuid()
```

**Performance note**: Random UUIDs (v4) scatter writes across the index, causing page splits and cache inefficiency on large tables. For high-throughput systems, consider UUIDv7 (time-sortable) if available via extension. At the scale of this project, the difference is negligible.

### INTEGER / BIGINT with IDENTITY (Alternative)

If you ever need sequential IDs:
```sql
user_id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY
```

Use `GENERATED ALWAYS AS IDENTITY` instead of `SERIAL` — it's the SQL standard and avoids several subtle bugs with permissions and sequence management.

### When to use which

| Scenario | Recommendation |
|---|---|
| Multi-region, distributed writes | UUID |
| Avoiding information leakage | UUID |
| High-performance scanning by PK | BIGINT IDENTITY |
| External-facing IDs | UUID |
| Internal-only, high-throughput | BIGINT IDENTITY |

---

## Data Type Selection

### TEXT vs VARCHAR(n)

**Use TEXT by default.** There is no performance difference between TEXT and VARCHAR (without length limit). In fact, `VARCHAR(n)` can be slightly slower due to length checking.

Add a CHECK constraint when there's an actual business reason for a length limit:
```sql
email TEXT NOT NULL CHECK (LENGTH(email) BETWEEN 5 AND 255)
```

The PostgreSQL wiki explicitly warns: "Don't use `varchar(n)` by default." Arbitrary limits like `VARCHAR(255)` break when real-world data exceeds them (Hubert Blaine Wolfeschlegelsteinhausenbergerdorff signs up, or a URL is longer than expected).

### INTEGER vs BIGINT

| Type | Range | When to use |
|---|---|---|
| `SMALLINT` | -32,768 to 32,767 | Really small numbers (status codes, enums stored as int) |
| `INTEGER` | -2.1B to 2.1B | Counts, IDs (when not using UUID), most numbers |
| `BIGINT` | Huge | Row counts for massive tables, aggregate sums |

Default to `INTEGER` unless you know the range will be exceeded. `BIGINT` uses 8 bytes vs 4 for `INTEGER`.

### BOOLEAN

Always `NOT NULL` with explicit `DEFAULT`. Three-state booleans (true/false/NULL) create subtle bugs because NULL is neither true nor false:
```sql
is_active BOOLEAN NOT NULL DEFAULT true
```

### NUMERIC vs DOUBLE PRECISION

- **`NUMERIC(p, s)`**: Exact decimal. Use for money, quantities where rounding is unacceptable.
- **`DOUBLE PRECISION`**: Approximate floating-point. Use for percentages, ratios, scientific data.

Never use `REAL` or `FLOAT` (imprecise) for money. The `MONEY` type is locale-dependent and has many issues — avoid entirely.

### JSONB

Use `JSONB` (not `JSON`) for unstructured or flexible-schema data. Differences:
- `JSONB`: Binary storage, indexable, slightly slower to insert, no duplicate keys, no whitespace
- `JSON`: Text storage, preserves formatting and key order, faster to insert

**When to use JSONB**: Truly dynamic fields (e.g., `preview_segments`, `limits` config, webhook `request_body`), where the schema varies per row.

**When NOT to use JSONB**: When the schema is known and stable — use proper columns. Structured data in columns is faster to query, type-safe, and self-documenting.

---

## Date/Time Storage

### Always use TIMESTAMPTZ

The PostgreSQL wiki is emphatic: "Don't use `timestamp` (without time zone)."

`TIMESTAMPTZ` stores a single point in time (internally UTC). It handles timezone conversions correctly for arithmetic, comparisons across timezones, and daylight savings transitions.

`TIMESTAMP` (without tz) stores whatever value you give it with no timezone awareness. It's a picture of a clock, not a point in time. Arithmetic between different locations or across DST boundaries gives wrong results.

```sql
created_at  TIMESTAMPTZ NOT NULL DEFAULT now()  -- Correct
created_at  TIMESTAMP DEFAULT now()              -- Wrong, avoid
```

### Don't use TIMETZ

The `TIME WITH TIME ZONE` type is included only for SQL standard compliance. The manual calls it of "questionable usefulness." Use `TIMESTAMPTZ` instead.

### Don't use BETWEEN with timestamps

`BETWEEN` includes both endpoints. For timestamps, this means double-counting midnight exactly:
```sql
-- WRONG: includes exactly midnight on '2024-06-08'
WHERE created_at BETWEEN '2024-06-01' AND '2024-06-08'

-- CORRECT
WHERE created_at >= '2024-06-01' AND created_at < '2024-06-09'
```

---

## Constraint Strategy

### NOT NULL by default

The official PostgreSQL docs say: "In most database designs the majority of columns should be marked not null." Every column should be NOT NULL unless NULL has a specific semantic meaning (e.g., "not yet set", "unknown", "optional").

### CHECK before application code

Domain validation belongs in the database:
```sql
CHECK (price > 0)
CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
CHECK (LENGTH(name) > 0)
CHECK (role IN ('OWNER', 'ADMIN', 'MEMBER'))
```

The database is the last line of defense. Application code can have bugs, multiple code paths can bypass validation, and direct DB access bypasses application logic entirely.

### FK ON DELETE decision tree

| When the parent is deleted... | Use | Example |
|---|---|---|
| Children should be deleted too | `ON DELETE CASCADE` | `users` → `api_keys` (keys are useless without user) |
| Children should become orphaned (keep with NULL FK) | `ON DELETE SET NULL` | `users` → `jobs` for public translation audit |
| Deletion should be blocked | `ON DELETE RESTRICT` | `plans` → `subscriptions` (don't delete plans with active subs) |

`ON DELETE SET DEFAULT` is rarely useful — it requires a default value that satisfies the FK constraint, which most UUID FKs don't have.

---

## Indexing Strategy

### The Golden Rules

1. **Index every FK column.** Without an index on the FK, `DELETE` on the parent table does a sequential scan of the child table. This is the most common performance bug.

2. **Index columns in WHERE clauses.** Especially for frequently executed queries and large tables.

3. **Don't over-index.** Every index slows down INSERT, UPDATE, and DELETE. Index only what you query.

4. **Use composite indexes correctly.** Column order matters: put equality conditions first, then range/sort conditions.

### When a single-column index is enough
```sql
CREATE INDEX ix_orders_user_id ON orders (user_id);
```
Use when queries filter on one column and retrieve a small subset of rows.

### When to use a composite index
```sql
-- Query: SELECT * FROM orders WHERE user_id = ? AND status = ? ORDER BY created_at
CREATE INDEX ix_orders_user_status_created ON orders (user_id, status, created_at);
```

### When to use a partial index
```sql
-- Only care about active jobs for most queries
CREATE INDEX ix_jobs_user_active ON jobs (user_id, status) WHERE status IN ('queued', 'parsing', 'translating', 'rebuilding');
```
Partial indexes are smaller and faster than full indexes when you consistently filter on a condition.

### When to use covering indexes (INCLUDE)
```sql
-- Avoid hitting the table for SELECT name, email WHERE ...
CREATE INDEX ix_users_email_cover ON users (email) INCLUDE (name);
```

PostgreSQL can do an index-only scan — reading the name directly from the index without visiting the table. Useful for frequently accessed columns.

### Index types and when to use them

| Type | Characteristics | Use cases |
|---|---|---|
| **B-tree** (default) | Equality, range, sorting, ordering | 95% of all indexes |
| **GIN** | Inverted index, good for many values per row | Full-text search (`tsvector`), JSONB containment (`@>`), array operations (`@>`) |
| **GiST** | Generalized search tree, flexible | Geometric data, full-text, range exclusion constraints |
| **BRIN** | Block range, very small, lossy | Very large append-only tables with natural sort order (time-series) |
| **Hash** | Equality only, smaller than B-tree | Rare — B-tree usually better |

---

## Normalization

### The Forms

**1NF** — Atomic values, no repeating groups:
- Every column holds a single value
- No arrays stored as comma-separated strings
- No repeating column groups (like `phone1, phone2, phone3`)

**2NF** — No partial dependencies (relevant for composite PKs):
- Every non-key column must depend on the *entire* primary key
- Only applies when you have a composite primary key

**3NF** — No transitive dependencies:
- Every non-key column must depend on the primary key and nothing else
- If column A determines column B, and column B determines column C, split into two tables

### When to Denormalize

Denormalization is a performance optimization, not a design starting point. Start with 3NF, then denormalize when:
1. You've measured that a JOIN is the bottleneck
2. The denormalized data is read far more often than written
3. You have a strategy for keeping denormalized data consistent (triggers, application code, or periodic reconciliation)

Examples of acceptable denormalization:
- Storing a `user_email` on `jobs` to avoid a JOIN in a hot query
- Counter caches (`total_files` on `batches` instead of counting related `jobs`)
- Materialized columns that are computed once and read many times

---

## PostgreSQL-Specific Features

### ENUM vs CHECK Constraint vs Lookup Table

| Approach | When to use |
|---|---|
| **ENUM type** | Values are fixed and rarely change (statuses, roles, types). Fast, type-safe, self-documenting. |
| **CHECK constraint** | Simple validation, few values, or when values might need to change via migration anyway. |
| **Lookup table** | Values are dynamic (user-managed), have additional metadata (descriptions, sort order), or change frequently. |

For this project, status/type columns use ENUM types. Adding a new status requires a migration (`ALTER TYPE ... ADD VALUE`), which is fine for infrequently changing sets.

### Table Partitioning

Use native partitioning (`PARTITION BY RANGE`) when a table will grow to millions of rows and queries consistently filter on a partition key (like `created_at`). The project doesn't currently use partitioning — it's a Phase 3 concern for audit logs and job history.

### Row-Level Security

Not needed for this project's current architecture. RLS is a PostgreSQL feature for multi-tenant databases where rows in the same table belong to different tenants. The project handles this at the application layer instead.

### Extensions Used

- **`pgcrypto`**: Provides `gen_random_uuid()` for UUID generation. Enabled by default in PostgreSQL 13+.
- **`uuid-ossp`**: Alternative UUID generation (if `pgcrypto` unavailable). Provides `uuid_generate_v4()`.

---

## Sources

- PostgreSQL Official Documentation: https://www.postgresql.org/docs/current/
- PostgreSQL Wiki "Don't Do This": https://wiki.postgresql.org/wiki/Don%27t_Do_This
- "Use The Index, Luke" by Markus Winand: https://use-the-index-luke.com/
- Supabase "Choosing a Postgres Primary Key": https://supabase.com/blog/choosing-a-postgres-primary-key
