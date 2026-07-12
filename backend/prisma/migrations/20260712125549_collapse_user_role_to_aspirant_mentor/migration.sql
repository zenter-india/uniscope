-- Collapse UserRole (PROSPECTIVE_STUDENT/CURRENT_STUDENT/ALUMNI/ADMIN) down to
-- (ASPIRANT/MENTOR/ADMIN). Mapping: PROSPECTIVE_STUDENT -> ASPIRANT;
-- CURRENT_STUDENT and ALUMNI -> MENTOR; ADMIN unchanged.
-- Postgres enums can't rename+remap values in one step, so we swap the type.

CREATE TYPE "UserRole_new" AS ENUM ('ASPIRANT', 'MENTOR', 'ADMIN');

ALTER TABLE "users"
  ALTER COLUMN "role" TYPE "UserRole_new"
  USING (
    CASE "role"::text
      WHEN 'PROSPECTIVE_STUDENT' THEN 'ASPIRANT'
      WHEN 'CURRENT_STUDENT' THEN 'MENTOR'
      WHEN 'ALUMNI' THEN 'MENTOR'
      WHEN 'ADMIN' THEN 'ADMIN'
    END::"UserRole_new"
  );

DROP TYPE "UserRole";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
