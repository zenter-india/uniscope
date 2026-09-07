-- Additive only: new nullable column, no data migration needed. This is Q5
-- of the 13-question university review form (2026-09-07 addition) — the
-- original Q5-Q11 choice fields already on this table are unaffected.
ALTER TABLE "reviews" ADD COLUMN "restroom_facilities" TEXT;
