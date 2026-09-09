-- "District Male Hospital" (Uttar Pradesh) was one row conflating two hospitals.
--
--   c84150b3  DNB seat -> AGRA's District Male Hospital
--             Diploma  -> BASTI's District Male Hospital
--             + a verified mentor's profile + verification + review
--             + a second (incomplete) aspirant profile
--   a006a628  Diploma + DNB, both BASTI — the real Basti row, no user data
--
-- The mentor is at Basti (their qualification is the Diploma, whose seat
-- description is "Basti"), so their review of "District Male Hospital" is
-- about Basti — but the card shows Agra (first program's district). Fix:
--   * a006a628 becomes the canonical Basti row (city = Basti)
--   * every user link on c84150b3 (2 profiles, 1 verification, 1 review)
--     moves to a006a628
--   * c84150b3's duplicate Basti Diploma program is dropped (a006a628 has one)
--   * c84150b3 keeps only the DNB/Agra seat and becomes the Agra row
--
-- Every statement is idempotent: a re-run finds the row/link already moved
-- and changes nothing.

UPDATE "universities" SET "city" = 'Basti', "updated_at" = now()
WHERE "id" = 'a006a628-03c3-4653-b07c-44f0f49f9a7e'
  AND ("city" IS NULL OR btrim("city") <> 'Basti');

UPDATE "universities" SET "city" = 'Agra', "updated_at" = now()
WHERE "id" = 'c84150b3-768f-4441-8e8e-29395c259083'
  AND ("city" IS NULL OR btrim("city") <> 'Agra');

UPDATE "user_profiles"
SET "university_id" = 'a006a628-03c3-4653-b07c-44f0f49f9a7e'
WHERE "university_id" = 'c84150b3-768f-4441-8e8e-29395c259083';

UPDATE "verification_requests"
SET "university_id" = 'a006a628-03c3-4653-b07c-44f0f49f9a7e'
WHERE "university_id" = 'c84150b3-768f-4441-8e8e-29395c259083';

-- move the review unless its author already has one on the Basti row
UPDATE "reviews" r
SET "university_id" = 'a006a628-03c3-4653-b07c-44f0f49f9a7e'
WHERE r."university_id" = 'c84150b3-768f-4441-8e8e-29395c259083'
  AND NOT EXISTS (
    SELECT 1 FROM "reviews" w
    WHERE w."author_id" = r."author_id"
      AND w."university_id" = 'a006a628-03c3-4653-b07c-44f0f49f9a7e'
  );

-- drop c84150b3's Basti Diploma (a006a628 already carries the Basti Diploma seat)
DELETE FROM "programs"
WHERE "university_id" = 'c84150b3-768f-4441-8e8e-29395c259083'
  AND "name" = 'DIPLOMA'
  AND btrim("description") = 'Basti';
