-- Degree levels a college offers ("UG"/"PG"). Every currently-seeded
-- college is UG-only (NMC's MBBS seat matrix is the only source imported
-- so far, no PG seat data exists yet). Array type, not a single enum value,
-- so a college can later be tagged both UG and PG without another migration.
ALTER TABLE "universities" ADD COLUMN "levels" TEXT[] NOT NULL DEFAULT ARRAY['UG']::TEXT[];
