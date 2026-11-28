# SOP 05: Database migrations

**Purpose:** change the database without breaking the code that is live.
**Who:** the developer changing the schema. **When:** any change to `backend/prisma/schema.prisma`.

`schema.prisma` is a coordinate-first file: tell the team before you edit it. Any migration is **High** tier. A destructive migration (dropping or narrowing a column, remapping an enum, deleting data) is **Critical** and needs Kiran's explicit approval.

## Why this needs care
Migrations run **every time the backend starts** (`prisma migrate deploy`). Preview shares the **production database**, so a migration that reaches Preview is live for production users at once, before the production code changes.

## Rules
- Make every migration safe for the code running in production **right now**.
- **Add first, switch the code over, remove later.** Never drop or rename in one step.
- Prefer nullable, additive columns and new tables. Existing rows are not touched. Recent examples: the `platform` column on `ledger_entries` and the lead failure columns.
- The ledger is append-only: never update old ledger rows. Work values out when they are read.
- New tables get **row level security enabled**, like every other table.
- Say "migration included" in the PR title or first line.

## Steps
1. Edit `backend/prisma/schema.prisma`.
2. Generate the SQL from the diff (works against the live dev database, no prompts):
   `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`
3. Create the folder by hand: `prisma/migrations/<YYYYMMDDHHMMSS>_<name>/migration.sql` (14-digit timestamp prefix is required). Put a short comment at the top saying what it does and that it is add-only.
4. Apply it with `npx prisma migrate deploy`. (Do not use `migrate dev` or `migrate reset`: they need an interactive terminal and `reset` would wipe data.)
5. For an **enum value remap**, hand-write the data-preserving pattern (create new type, `ALTER TABLE … USING (CASE …)`, drop old, rename). See `prisma/migrations/20260712125549_collapse_user_role_to_aspirant_mentor/migration.sql`.
6. Run backend tests. Include the migration in the PR and name the tier.
7. After the release, confirm the migration is listed in `_prisma_migrations`.

## Check it worked
The backend starts, `/health` is OK, the new column or table exists, and the old code path still works.

## If it goes wrong
Stop. Tell Kiran. Do not edit production data by hand and do not run `migrate reset`. A bad migration is fixed with a new, additive migration.

Last checked: 2026-11-28.
