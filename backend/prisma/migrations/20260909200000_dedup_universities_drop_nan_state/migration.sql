-- Two catalogue-hygiene cleanups.
--
-- A) 38 rows have state = 'nan' (blank in the NBEMS source). All are
--    generic hospital names ("Fortis Hospital", "District Hospital") with
--    no city, no programs, no reviews, no linked mentors — unusable and
--    just noise in search. Deactivate them.
--
-- B) True duplicate rows: same name + state + city + stream. These are
--    double-seed artifacts (e.g. "ACS Medical College and Hospital",
--    Chennai, Medical appears twice — one with a program, one empty).
--    NOT touched: rows that share only a generic name+state but differ by
--    city ("Government Medical College" x23 in Telangana are 23 real
--    colleges), and the same university seeded once per stream (an
--    Engineering + a Law row for one deemed university — the stream filter
--    needs both). Only dedups when the city is known, so an ambiguous pair
--    is left alone.
--
--    Winner per group = most active programs, then most reviews, then most
--    linked mentors, then oldest, then lowest id. Losers' programs /
--    reviews / verification requests / mentor links / enrollment leads /
--    saved-university rows are repointed to the winner (skipping any that
--    would collide on a unique index), the winner's `levels` is unioned
--    with the losers', and the losers are deactivated (not deleted, so any
--    stray reference stays resolvable).

------------------------------------------------------------------- A --------
UPDATE "universities"
SET "is_active" = false, "updated_at" = now()
WHERE "is_active" AND lower(btrim("state")) = 'nan';

------------------------------------------------------------------- B --------
CREATE TEMPORARY TABLE "_dup_merge" ON COMMIT DROP AS
WITH scored AS (
  SELECT u."id",
    lower(btrim(u."name"))                       AS n,
    lower(btrim(u."state"))                       AS s,
    lower(btrim(coalesce(u."city", '')))          AS c,
    u."stream"                                    AS st,
    u."created_at"                                AS created_at,
    (SELECT count(*) FROM "programs" p
       WHERE p."university_id" = u."id" AND p."is_active")           AS nprog,
    (SELECT count(*) FROM "reviews" r
       WHERE r."university_id" = u."id")                             AS nrev,
    (SELECT count(*) FROM "user_profiles" up
       WHERE up."university_id" = u."id")                            AS nusr
  FROM "universities" u
  WHERE u."is_active"
),
ranked AS (
  SELECT id, n, s, c, st,
    row_number() OVER w  AS rn,
    first_value(id) OVER w AS winner_id
  FROM scored
  WHERE c <> ''
  WINDOW w AS (
    PARTITION BY n, s, c, st
    ORDER BY nprog DESC, nrev DESC, nusr DESC, created_at ASC, id ASC
  )
)
SELECT id AS loser_id, winner_id
FROM ranked
WHERE rn > 1;

-- programs: move, unless the winner already has a program with that name
UPDATE "programs" p
SET "university_id" = m."winner_id"
FROM "_dup_merge" m
WHERE p."university_id" = m."loser_id"
  AND NOT EXISTS (
    SELECT 1 FROM "programs" w
    WHERE w."university_id" = m."winner_id" AND w."name" = p."name"
  );
DELETE FROM "programs" p USING "_dup_merge" m
WHERE p."university_id" = m."loser_id";

-- saved_universities: move, unless the aspirant already saved the winner
UPDATE "saved_universities" sv
SET "university_id" = m."winner_id"
FROM "_dup_merge" m
WHERE sv."university_id" = m."loser_id"
  AND NOT EXISTS (
    SELECT 1 FROM "saved_universities" w
    WHERE w."aspirant_id" = sv."aspirant_id" AND w."university_id" = m."winner_id"
  );
DELETE FROM "saved_universities" sv USING "_dup_merge" m
WHERE sv."university_id" = m."loser_id";

-- the rest have no conflicting unique index on university_id
UPDATE "reviews" r               SET "university_id" = m."winner_id" FROM "_dup_merge" m WHERE r."university_id" = m."loser_id";
UPDATE "verification_requests" v SET "university_id" = m."winner_id" FROM "_dup_merge" m WHERE v."university_id" = m."loser_id";
UPDATE "user_profiles" up        SET "university_id" = m."winner_id" FROM "_dup_merge" m WHERE up."university_id" = m."loser_id";
UPDATE "enrollment_leads" e      SET "university_id" = m."winner_id" FROM "_dup_merge" m WHERE e."university_id" = m."loser_id";

-- union the winner's levels with the losers'
UPDATE "universities" w
SET "levels" = sub.merged, "updated_at" = now()
FROM (
  SELECT m."winner_id",
    array_agg(DISTINCT lv ORDER BY lv) AS merged
  FROM "_dup_merge" m
  JOIN "universities" l ON l."id" = m."loser_id"
  JOIN "universities" wu ON wu."id" = m."winner_id"
  CROSS JOIN LATERAL unnest(wu."levels" || l."levels") AS lv
  GROUP BY m."winner_id"
) sub
WHERE w."id" = sub."winner_id" AND w."levels" IS DISTINCT FROM sub.merged;

-- deactivate the losers
UPDATE "universities"
SET "is_active" = false, "updated_at" = now()
WHERE "id" IN (SELECT loser_id FROM "_dup_merge");
