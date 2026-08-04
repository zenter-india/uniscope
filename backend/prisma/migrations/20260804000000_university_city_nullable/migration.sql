-- The authoritative NMC seat matrix has no city column; city is only
-- derivable from the college name for ~69% of rows. Making it nullable so
-- the seed can omit it rather than writing the state name into `city`.
ALTER TABLE "universities" ALTER COLUMN "city" DROP NOT NULL;
