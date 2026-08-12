-- Removes EnrollmentLead.goals: redundant with courseInterested, which
-- already captures what an aspirant is aiming for. Dropped rather than left
-- unused, per explicit product decision.
ALTER TABLE "enrollment_leads" DROP COLUMN "goals";

-- Widened to fit multiple comma-joined picks now that the web form allows
-- multi-select on both preferred language and preferred mentorship timing.
ALTER TABLE "enrollment_leads" ALTER COLUMN "preferred_language" TYPE VARCHAR(150);
ALTER TABLE "enrollment_leads" ALTER COLUMN "preferred_mentorship_timing" TYPE VARCHAR(150);
