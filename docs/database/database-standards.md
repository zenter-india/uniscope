# MedConnect — Database Standards

**Version:** 1.0  
**Status:** Approved  
**Date:** 2026-06-10  
**Owner:** Engineering

---

## 1. Naming Conventions

### Tables
- **Format:** `snake_case`, plural noun.
- **Examples:** `users`, `user_profiles`, `universities`, `verification_requests`, `answer_votes`.
- All Prisma models use `@@map("snake_case_table_name")` to enforce this in migrations.

### Columns
- **Format:** `snake_case`.
- All Prisma fields use `@map("snake_case_column_name")` for camelCase fields.
- **Examples:** `phone_hash`, `display_name`, `created_at`, `deleted_at`, `university_id`.

### Primary Keys
- **Column name:** always `id`.
- **Type:** `UUID` (PostgreSQL `uuid` type), generated with `gen_random_uuid()` or Prisma's `@default(uuid())`.
- Rationale: UUID PKs are optimal for Supabase, prevent ID enumeration, and are safe to expose in URLs.

### Foreign Keys
- **Format:** `<related_entity>_id` in snake_case.
- **Examples:** `user_id`, `university_id`, `reviewed_by` (explicit name when FK has a role).
- Always define both sides of the relation in Prisma with `@relation`.

### Indexes
- **Format:** `idx_<table>_<column(s)>` — e.g., `idx_questions_university_id_created_at`.
- Prisma generates index names automatically; the convention above applies to manually created SQL indexes in migrations.

### Enums
- **Format:** `SCREAMING_SNAKE_CASE` for enum values.
- **Examples:** `PROSPECTIVE_STUDENT`, `UNDER_REVIEW`, `VERIFICATION_DOCS`.
- PostgreSQL enum type names use `PascalCase` matching the Prisma enum name (e.g., `UserRole`, `VerificationStatus`).

---

## 2. Migration Strategy

### Creating Migrations

Use Prisma Migrate Dev for all schema changes in local/staging:

```bash
cd backend
npx prisma migrate dev --name <descriptive_name>
```

### Migration Naming Convention

Names must be short, lowercase, underscore-separated descriptions of **what changed** (not why):

| ✅ Good | ❌ Bad |
|--------|-------|
| `add_universities_search_vector` | `migration_june` |
| `create_users_table` | `fix_stuff` |
| `add_idx_questions_university_id` | `update_schema` |
| `drop_column_push_tokens` | `new_feature` |

### Production Deploys

```bash
npx prisma migrate deploy
```

Never run `migrate dev` against production. Use `migrate deploy` in CI/CD pipelines.

### Review Process

1. **Schema change** → run `prisma migrate dev --name <name>` locally.
2. **Review** the generated SQL in `prisma/migrations/<timestamp>_<name>/migration.sql` before committing.
3. **PR review** — migrations must be reviewed by at least one other engineer.
4. **Irreversible changes** (dropping columns, renaming) require a two-phase migration:
   - Phase 1: add new column / keep old (deploy).
   - Phase 2: remove old column after code is fully deployed (second PR).

### Raw SQL Migrations

Some features (tsvector GIN indexes, trigram indexes, generated columns, partial indexes) require raw SQL. Place these in a Prisma migration's `migration.sql` directly:

```sql
-- Example: full-text search on universities
ALTER TABLE universities
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce(name, '') || ' ' ||
      coalesce(city, '') || ' ' ||
      coalesce(state, '')
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_universities_search_vector
  ON universities USING gin(search_vector);

-- Trigram index for autocomplete (requires pg_trgm extension)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_universities_name_trgm
  ON universities USING gin(name gin_trgm_ops);
```

---

## 3. Indexing Standards

### When to Add Indexes

Add a `@@index` (or raw SQL index) when:
- The column is used in a `WHERE` clause on a large table (> 10k rows).
- The column is used in an `ORDER BY` on a paginated list endpoint.
- The column is a foreign key used in JOINs or nested relation queries.
- The column is part of a uniqueness constraint (`@@unique`).

**Do not** add indexes on columns that are:
- Only written, never queried (e.g., `updated_at` alone).
- On very small tables (< 1k rows) — sequential scans are faster.
- Low-cardinality boolean columns used in isolation (e.g., `is_active` alone — use partial index instead).

### Composite Index Rules

- Column order matters: put the **most selective** or **equality-filtered** column first.
- For sort + filter patterns: `(filter_col, sort_col DESC)` — e.g., `(university_id, created_at DESC)`.
- Prisma syntax: `@@index([universityId, createdAt(sort: Desc)])`.

### Partial Indexes

Use partial indexes for queries that always filter on a specific value:

```sql
-- Only active questions (most queries filter deletedAt IS NULL)
CREATE INDEX idx_questions_university_active
  ON questions(university_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- Unread messages per room
CREATE INDEX idx_messages_room_unread
  ON messages(room_id)
  WHERE is_read = false;

-- Pending verification requests (hot path for admin queue)
CREATE INDEX idx_verification_requests_pending
  ON verification_requests(submitted_at)
  WHERE status = 'SUBMITTED';
```

> Partial indexes defined in Prisma: not directly supported — add them in raw SQL migration files.

### GIN Indexes (Full-Text Search)

Required on all `tsvector` and `String[]` columns:

```sql
CREATE INDEX idx_universities_search ON universities USING gin(search_vector);
CREATE INDEX idx_questions_search ON questions USING gin(search_vector);
CREATE INDEX idx_questions_tags ON questions USING gin(tags);
CREATE INDEX idx_answers_search ON answers USING gin(search_vector);
CREATE INDEX idx_reviews_search ON reviews USING gin(search_vector);
```

---

## 4. Audit Fields

Every table **must** include the following audit columns:

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Record creation time |
| `updated_at` | `timestamptz` | `NOT NULL` (auto-set by Prisma `@updatedAt`) | Last modification time |

Prisma enforces these via `@default(now())` and `@updatedAt` decorators.

**Exception:** `answer_votes` — this is an append-only junction table; `updated_at` is omitted by design as votes are never modified.

---

## 5. Soft Delete Policy

### Which Entities Use Soft Delete

| Entity | Soft Delete | Rationale |
|--------|-------------|-----------|
| `users` | ✅ | Account closure must retain FK references for audit |
| `verification_requests` | ✅ | Document reference retained 7 years (regulatory) |
| `questions` | ✅ | Answers reference deleted questions; preserve thread context |
| `answers` | ✅ | Votes reference deleted answers; preserve vote counts |
| `reviews` | ✅ | Admin hide/remove without destroying data |
| `messages` | ✅ | "Unsend" feature; preserve chat thread continuity |
| `notifications` | ✅ | Dismiss without hard-delete |
| `answer_votes` | ❌ | Atomic; truly deleted on un-vote |
| `universities` | ❌ | Use `is_active = false` instead |
| `programs` | ❌ | Use `is_active = false` instead |
| `chat_rooms` | ❌ | Use `status = CLOSED/BLOCKED` instead |
| `reports` | ❌ | Audit trail; never deleted |
| `user_profiles` | ❌ | Lifecycle tied to User; soft-delete User instead |

### `deletedAt` Column

```sql
deleted_at  timestamptz  NULL  -- NULL = active; non-NULL = soft-deleted
```

### Service Layer Query Rule

**Every** service query on a soft-deletable table **must** include the active filter:

```typescript
// ✅ Correct
await prisma.question.findMany({
  where: { universityId, deletedAt: null },
});

// ❌ Wrong — returns soft-deleted records
await prisma.question.findMany({
  where: { universityId },
});
```

Admin endpoints may query all records (including soft-deleted) when needed for audit/moderation:

```typescript
// Admin: include soft-deleted
await prisma.question.findMany({
  where: { universityId }, // no deletedAt filter
});
```

### Hard Delete

Hard deletes are **never** performed by the application except:
1. The 7-year regulatory purge job on verification documents.
2. GDPR/data erasure requests processed by engineering (not automated).

---

## 6. Supabase-Specific Notes

### UUID Primary Keys

All tables use `UUID` PKs generated by Prisma (`@default(uuid())`), which calls `gen_random_uuid()` under the hood in PostgreSQL. This is preferred over `SERIAL` or `BIGSERIAL` for:
- Global uniqueness without coordination.
- Safe to expose in URLs (non-enumerable).
- Supabase Row Level Security policies work natively with UUID columns.

### Row Level Security (RLS)

**RLS is disabled at the Prisma/backend layer.** All access control is enforced in NestJS service methods using guard decorators and explicit `WHERE` clauses.

Rationale: The backend uses the Supabase **service-role key**, which bypasses RLS. This gives full programmatic control over queries without the complexity of RLS policy management for a backend-driven architecture.

> If direct Supabase client access (from mobile/admin) is ever added, RLS policies must be defined and enabled for those tables.

### Connection Pooling (pgBouncer)

Supabase provides pgBouncer at port `5432` (transaction mode). When connecting from a serverless or high-concurrency environment, append `?pgbouncer=true` to `DATABASE_URL` and set `connection_limit=1` in `prisma.config.ts`:

```typescript
// prisma.config.ts — serverless / edge
datasource: {
  url: env('DATABASE_URL'), // includes ?pgbouncer=true
}
```

For long-running NestJS processes (not serverless), direct connections on port `5432` are preferred for Prisma compatibility with interactive transactions.

### Migrations on Supabase

Run migrations against the Supabase **direct connection** string (port `5432`, not the pooler), as `ALTER TABLE`, `CREATE INDEX`, and DDL statements require a non-pooled connection:

```bash
DATABASE_URL="postgresql://postgres:[pw]@db.[ref].supabase.co:5432/postgres" \
  npx prisma migrate deploy
```
