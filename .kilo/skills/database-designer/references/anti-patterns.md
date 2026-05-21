# Database Anti-Patterns

Common mistakes in PostgreSQL schema design — what they are, why they're harmful, and what to do instead. Curated from the PostgreSQL wiki "Don't Do This," real-world debugging experience, and industry literature.

---

## Table of Contents

1. [Text Storage Anti-Patterns](#text-storage-anti-patterns)
2. [Date/Time Storage Anti-Patterns](#datetime-storage-anti-patterns)
3. [Numeric Type Anti-Patterns](#numeric-type-anti-patterns)
4. [Identifier Anti-Patterns](#identifier-anti-patterns)
5. [Constraint Anti-Patterns](#constraint-anti-patterns)
6. [Index Anti-Patterns](#index-anti-patterns)
7. [Structural Anti-Patterns](#structural-anti-patterns)

---

## Text Storage Anti-Patterns

### CHAR(n) instead of TEXT

**What**: Using `CHAR(3)` for country codes, `CHAR(64)` for hashes, etc.

**Why it's wrong**: `CHAR(n)` silently pads values with spaces to the declared width. `'US'` stored in `CHAR(3)` becomes `'US '`. This causes:
- Unexpected comparison failures when spaces matter
- Wasted storage space
- Slower operations (padding must be stripped in many contexts)
- No performance benefit whatsoever

**Fix**: Use `TEXT` with a CHECK constraint:
```sql
-- Wrong
country_code CHAR(3) NOT NULL

-- Correct
country_code TEXT NOT NULL CHECK (LENGTH(country_code) = 3)
-- Or even better, validate format too
country_code TEXT NOT NULL CHECK (country_code ~ '^[A-Z]{2,3}$')
```

### Arbitrary VARCHAR(n) limits

**What**: Using `VARCHAR(255)` for name fields without a business reason.

**Why it's wrong**: When real data exceeds the arbitrary limit (long names, URLs, legal descriptions), you get production errors. There's no performance benefit to `VARCHAR(255)` over `TEXT`.

**Fix**: Use `TEXT` by default. Add a CHECK constraint with a *meaningful* limit only when it comes from a real requirement:
```sql
-- Wrong
name VARCHAR(255) NOT NULL

-- Correct (no limit needed)
name TEXT NOT NULL

-- Correct (real business limit)
name TEXT NOT NULL CHECK (LENGTH(name) <= 500)  -- e.g., fits on a printed form
```

---

## Date/Time Storage Anti-Patterns

### TIMESTAMP (without time zone)

**What**: Using `TIMESTAMP` instead of `TIMESTAMPTZ`.

**Why it's wrong**: `TIMESTAMP` stores whatever date-time you give it with no timezone awareness. It's a picture of a clock, not a point in time. This means:
- Arithmetic between timestamps from different timezones gives wrong results
- Comparisons across DST boundaries give wrong results
- You can't convert "3pm in Tokyo" and "noon in London" to the same moment
- You can't tell if `'2024-06-01 12:00:00'` is noon UTC, noon EST, or noon IST

**Fix**: Always use `TIMESTAMPTZ`:
```sql
-- Wrong
created_at TIMESTAMP DEFAULT now()

-- Correct
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
```

### Storing UTC in TIMESTAMP (without time zone)

**What**: A pattern inherited from databases that lack timezone support — storing UTC values in a `TIMESTAMP` column and "knowing" it's UTC.

**Why it's wrong**: The database doesn't know it's UTC. Timezone conversion queries become absurdly complex:
```sql
-- This is what you end up writing
date_trunc('day', now() AT TIME ZONE u.timezone) AT TIME ZONE u.timezone AT TIME ZONE 'UTC'
```

**Fix**: Use `TIMESTAMPTZ` and let PostgreSQL handle it.

### Using BETWEEN with timestamps

**What**: `WHERE created_at BETWEEN '2024-06-01' AND '2024-06-08'`

**Why it's wrong**: `BETWEEN` is inclusive on both ends. Timestamps exactly at midnight on the upper bound get included in two consecutive date ranges, causing double-counting.

**Fix**: Use `>=` and `<`:
```sql
-- Wrong
WHERE created_at BETWEEN '2024-06-01' AND '2024-06-08'

-- Correct
WHERE created_at >= '2024-06-01' AND created_at < '2024-06-09'
```

---

## Numeric Type Anti-Patterns

### MONEY type

**What**: Using PostgreSQL's `MONEY` data type.

**Why it's wrong**:
- Locale-dependent — the currency is set by `lc_monetary`, not stored with the value
- If `lc_monetary` changes, all `MONEY` columns change meaning
- No fractional cents support
- Rounding behavior is unintuitive
- Input/output format varies by locale

**Fix**: Use `NUMERIC` for the amount and store currency separately if multi-currency is needed:
```sql
-- Wrong
price MONEY

-- Correct (single currency)
price NUMERIC(10,2) NOT NULL CHECK (price >= 0)

-- Correct (multi-currency)
price_amount NUMERIC(10,2) NOT NULL CHECK (price_amount >= 0),
price_currency TEXT NOT NULL DEFAULT 'USD' CHECK (price_currency ~ '^[A-Z]{3}$')
```

### SERIAL instead of IDENTITY

**What**: Using `SERIAL`, `BIGSERIAL` for auto-incrementing columns.

**Why it's wrong**:
- Not SQL standard — PostgreSQL-specific legacy
- Weird permission behavior (sequence permissions are separate from table permissions)
- Can't be added to an existing column
- Sequence isn't automatically dropped with the table in some cases
- No built-in way to prevent accidental overwrites

**Fix**: Use `GENERATED AS IDENTITY` (PostgreSQL 10+):
```sql
-- Wrong
id SERIAL PRIMARY KEY

-- Correct
id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY
```

In this project, UUIDs are used instead of auto-incrementing integers, so this anti-pattern is less relevant.

### REAL / FLOAT for money

**What**: Using floating-point types for financial calculations.

**Why it's wrong**: Floating-point arithmetic introduces rounding errors. `0.1 + 0.2 != 0.3` in floating point. Over many operations, these errors compound and money goes missing.

**Fix**: Use `NUMERIC` (exact decimal) or `INTEGER` (store cents):
```sql
-- Wrong
price FLOAT

-- Correct
price NUMERIC(10,2)
-- or
price_cents INTEGER NOT NULL CHECK (price_cents >= 0)
```

---

## Identifier Anti-Patterns

### Upper-case table or column names

**What**: `Create table "UserProfiles" (...)`

**Why it's wrong**: PostgreSQL folds unquoted identifiers to lower case. `UserProfiles` becomes `userprofiles`. To preserve case, you must double-quote everywhere (`"UserProfiles"`), which is tedious and error-prone. Some tools auto-quote, some don't — leading to confusing "relation does not exist" errors.

**Fix**: Use `snake_case` for everything:
```sql
-- Wrong
CREATE TABLE "UserProfiles" (...)

-- Correct
CREATE TABLE user_profiles (...)
```

### PK column named just `id`

**What**: Using `id` as the primary key column name in every table.

**Why it's wrong**: In JOINs across multiple tables, you can't tell which `id` is which:
```sql
-- This looks fine but is full of bugs
SELECT * FROM emails e
JOIN stars s ON s.id = e.id         -- star_id = email_id? Bug!
JOIN routes r ON r.id = s.id        -- route_id = star_id? Bug!
```
With descriptive PK names, bugs jump out:
```sql
-- Bugs are visible
SELECT * FROM emails e
JOIN stars s ON s.star_id = e.email_id  -- Clearly wrong!
```

**Fix**: Name PK columns `{table_singular}_id`:
```sql
-- Correct
user_id UUID PRIMARY KEY,
job_id UUID PRIMARY KEY,
team_id UUID PRIMARY KEY
```

---

## Constraint Anti-Patterns

### Missing FK indexes

**What**: Having a foreign key column without an index on it.

**Why it's wrong**: When the parent row is deleted or its PK is updated, PostgreSQL must scan the entire child table to enforce referential integrity. For large tables, this means a sequential scan (potentially millions of rows) for every parent DELETE, taking the table lock for a very long time.

**Fix**: Index every FK column:
```sql
-- After defining the FK
CREATE INDEX ix_jobs_user_id ON jobs (user_id);
```

### No ON DELETE clause on FKs

**What**: Creating FKs without specifying `ON DELETE` behavior.

**Why it's wrong**: The default (`ON DELETE NO ACTION`) is a subtle trap. It allows the DELETE to proceed but then fails at the end of the transaction if dangling references exist — which is almost never what you want. You either want `CASCADE`, `SET NULL`, or `RESTRICT`.

**Fix**: Always specify `ON DELETE` explicitly:
```sql
-- Wrong (default NO ACTION is rarely intended)
user_id UUID REFERENCES users(user_id)

-- Correct
user_id UUID REFERENCES users(user_id) ON DELETE CASCADE
```

---

## Index Anti-Patterns

### Indexing low-cardinality columns

**What**: Creating an index on `is_active` or `status` when one value represents 98% of rows.

**Why it's wrong**: A B-tree index on a column with few distinct values is rarely used — the planner will prefer a sequential scan because the index doesn't narrow the result set enough. The index wastes storage and slows down writes.

**Fix**: Only index low-cardinality columns as part of a composite index:
```sql
-- Wrong (if 99% of users are active)
CREATE INDEX ix_users_is_active ON users (is_active);

-- Correct (composite, narrowing by user first)
CREATE INDEX ix_users_user_active ON users (user_id, is_active);
```

### Indexing columns that are never queried

**What**: Adding indexes "just in case" or because a column "seems important."

**Why it's wrong**: Every index consumes storage and slows down INSERT, UPDATE, DELETE. Unused indexes provide zero benefit and constant cost.

**Fix**: Only create indexes when you know the query pattern:
- What queries will filter on this column?
- What JOINs use this column?
- What ORDER BY clauses include this column?

### Using GIN for everything

**What**: Defaulting to GIN indexes because "they handle everything."

**Why it's wrong**: GIN indexes are slower to build and update than B-tree. For equality and range queries, B-tree is always faster.

**Fix**: Use the right index type for the query pattern:
- Equality, range, sort → B-tree
- Full-text search (`tsvector`) → GIN
- JSONB containment (`@>`) → GIN
- Geometric, range exclusion → GiST

---

## Structural Anti-Patterns

### Entity-Attribute-Value (EAV)

**What**: Creating a generic `attributes` table (entity_id, attribute_name, attribute_value) instead of proper columns.

**Why it's wrong**:
- Impossible to enforce type safety (all values stored as text)
- Queries become complex pivots
- No referential integrity for attribute values
- Indexing is ineffective
- Reporting and analytics become nightmares

**Fix**: Use proper columns when the schema is known. Use JSONB for truly dynamic attributes with unknown schema at design time — but prefer proper columns whenever possible.

### Over-normalization

**What**: Splitting every repeating value into its own table, even when it adds no value.

**Why it's wrong**: Excessive JOINs hurt performance and readability. A `user_phone_numbers` table for 2 phone numbers per user adds complexity without benefit.

**Fix**: Normalize to 3NF as a starting point, then denormalize where it makes practical sense. Two phone numbers stored as `phone_primary` and `phone_secondary` columns is better than a separate phone numbers table.

### Generic junction tables without purpose

**What**: Creating a generic `relationships` table (parent_type, parent_id, child_type, child_id) for all M:N relationships.

**Why it's wrong**: Same problems as EAV — no referential integrity, no type safety, un-indexable, un-queryable.

**Fix**: Create specific junction tables for each M:N relationship:
```sql
-- Wrong
CREATE TABLE relationships (
    parent_type TEXT,
    parent_id UUID,
    child_type TEXT,
    child_id UUID
);

-- Correct
CREATE TABLE plan_provider_mappings (
    mapping_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES plans(plan_id) ON DELETE CASCADE,
    provider_id UUID NOT NULL REFERENCES providers(provider_id) ON DELETE CASCADE,
    priority INTEGER NOT NULL DEFAULT 0,
    UNIQUE (plan_id, provider_id)
);
```

---

## Sources

- PostgreSQL Wiki "Don't Do This": https://wiki.postgresql.org/wiki/Don%27t_Do_This
- PostgreSQL Official Documentation, Section 8 (Data Types): https://www.postgresql.org/docs/current/datatype.html
- PostgreSQL Official Documentation, Section 5.5 (Constraints): https://www.postgresql.org/docs/current/ddl-constraints.html
- "Use The Index, Luke" by Markus Winand: https://use-the-index-luke.com/
