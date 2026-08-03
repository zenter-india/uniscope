-- AlterTable
ALTER TABLE "user_profiles" ADD COLUMN     "availability_set_at" TIMESTAMPTZ;

-- Backfill: mentors who are currently marked available have no timestamp yet,
-- and every read path treats a null timestamp as expired. Without this, the
-- migration would silently drop every already-available mentor out of call
-- eligibility the moment it lands. Give them a fresh window instead.
UPDATE "user_profiles"
SET "availability_set_at" = NOW()
WHERE "is_mentor_available" = true AND "availability_set_at" IS NULL;
