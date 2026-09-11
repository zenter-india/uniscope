-- Follow-up to 20260911120000 (District Male Hospital, Basti's Diploma
-- program). That one row turned out to be one instance of a much wider
-- pattern: 406 more curated-degree programs on otherwise-active
-- universities are is_active=false with NO active sibling row for the
-- same (university_id, name) -- not dedup leftovers, just silently
-- unreachable from UniversitiesService.findCurated's `isActive: true`
-- filter since the original 2026-08-22 seed import, exactly like Basti.
--
-- Verified before writing this (see CLAUDE.md for the full audit):
--   - 0 of the 406 have empty `specializations` arrays.
--   - 0 match test/placeholder/garbage name or specialization patterns.
--   - Sampled rows are real, well-known institutions (SVIMS Tirupati, Sri
--     Ramachandra Chennai, Father Muller's Mangalore, Assam Medical
--     College, ...) with realistic specialization lists.
--   - DM/MCh's blank `description` on all of its 207 rows here initially
--     looked like a quality red flag (only 8/108 *active* DM/MCh rows are
--     blank) -- but findCurated already renders a blank description as
--     "name, state" instead of "name, district, state" (same fallback
--     MD/MS relies on for 100% of its own rows), so it's a cosmetic
--     label difference, not missing/bad data.
-- Breakdown: DM/MCh 207, Diploma 109, DNB 74, MD/MS 15, M.Tech 1.
UPDATE "programs" p
SET "is_active" = true, "updated_at" = now()
FROM "universities" u
WHERE p."university_id" = u."id"
  AND u."is_active" = true
  AND p."is_active" = false
  AND p."name" IN ('DNB', 'MD/MS', 'DIPLOMA', 'DM/MCH', 'MDS', 'B.TECH', 'M.TECH', 'DIPLOMA-ENGG', 'LAW-UG', 'LAW-PG')
  AND NOT EXISTS (
    SELECT 1 FROM "programs" p2
    WHERE p2."university_id" = p."university_id"
      AND p2."name" = p."name"
      AND p2."is_active" = true
  );
