-- Data cleanup: strip import artifacts from University.name so the raw
-- source formatting never shows on a card.
--   * leading admission/institute codes like "100005-" or "3143 "
--   * runs of 2+ spaces collapsed to one
-- Ownership words baked into a name (e.g. the single "(Private ) ..." row)
-- were handled individually; ALL-CAPS names are left alone — case-folding
-- them safely needs acronym/roman-numeral handling, a separate pass.

UPDATE "universities"
SET "name" = regexp_replace("name", '^[0-9]{3,7}\s*[-–]?\s*', ''),
    "updated_at" = now()
WHERE "name" ~ '^[0-9]{3,7}\s*[-–]?\s*[A-Za-z(]';

UPDATE "universities"
SET "name" = btrim(regexp_replace("name", '\s{2,}', ' ', 'g')),
    "updated_at" = now()
WHERE "name" ~ '\s{2,}' OR "name" <> btrim("name");
