-- Real bug found 2026-09-11 (report: "District Male hospital, Basti" not
-- appearing in the mentor onboarding wizard's college search when
-- Medical + Diploma is picked). The Basti college's own DIPLOMA program
-- (id c87a78df-970e-4451-b9d6-bcdafe1210e4) has real specialization data
-- ("Tuberculosis & Chest Disease - DTCD") and no active duplicate — it was
-- simply seeded with is_active=false on 2026-08-22 (predates every
-- migration in this repo), so UniversitiesService.findCurated's
-- `isActive: true` filter silently excluded it from every curated
-- search/browse result. Scoped to this one row; a wider audit found 407
-- similarly-inactive-with-no-active-sibling curated programs across DNB/
-- MD-MS/Diploma/DM-MCh/M.Tech (see CLAUDE.md) — deliberately NOT touched
-- here pending a decision on why the seed marked them inactive.
UPDATE "programs"
SET "is_active" = true, "updated_at" = now()
WHERE "id" = 'c87a78df-970e-4451-b9d6-bcdafe1210e4'
  AND "is_active" = false;
