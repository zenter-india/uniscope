-- University reviews move to the client-confirmed 12-question structured
-- form. The old {overallRating, comment, boolean wouldRecommend} shape
-- can't be backfilled into the new per-question answers, and only one
-- legacy row existed — per explicit product decision it is cleared.
DELETE FROM "reviews";

-- Q5–Q11: single-choice answers, stored as short stable codes
-- (see src/modules/university-reviews/dto/review-choices.ts for the value
-- sets and their exact display labels). Nullable at the DB so a partial
-- row still reads; the create DTO requires all seven.
ALTER TABLE "reviews"
  ADD COLUMN "ragging_culture" TEXT,
  ADD COLUMN "faculty_approachability" TEXT,
  ADD COLUMN "stipend_status" TEXT,
  ADD COLUMN "hostel_availability" TEXT,
  ADD COLUMN "hostel_safety" TEXT,
  ADD COLUMN "value_for_money" TEXT;

-- Q10 "Would You Recommend?" was a plain Boolean; the structured form
-- makes it a 4-way choice code (ABSOLUTELY / RIGHT_PERSON / DEPENDS /
-- PROBABLY_NOT). The table is emptied above, so drop + re-add rather than
-- an ALTER ... USING.
ALTER TABLE "reviews" DROP COLUMN "would_recommend";
ALTER TABLE "reviews" ADD COLUMN "would_recommend" TEXT;

-- Mentors whose verification is APPROVED from here on must review their own
-- college before they can switch on call bookings. Existing verified
-- mentors keep the default (false) and are unaffected.
ALTER TABLE "user_profiles"
  ADD COLUMN "must_review_college" BOOLEAN NOT NULL DEFAULT false;
