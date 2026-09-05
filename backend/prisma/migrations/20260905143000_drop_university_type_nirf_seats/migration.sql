-- Remove university classification, NIRF ranking, and MBBS seat count
-- from the catalogue entirely (product decision, 2026-09-05). These were
-- only ever meaningfully populated for a small slice of medical colleges
-- and are no longer shown anywhere in the app or admin panel.

DROP INDEX IF EXISTS "universities_type_idx";
DROP INDEX IF EXISTS "universities_nirf_rank_idx";

ALTER TABLE "universities"
  DROP COLUMN IF EXISTS "type",
  DROP COLUMN IF EXISTS "nirf_rank",
  DROP COLUMN IF EXISTS "mbbs_seats";

DROP TYPE IF EXISTS "UniversityType";
