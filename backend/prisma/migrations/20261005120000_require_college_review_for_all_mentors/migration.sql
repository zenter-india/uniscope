-- Every mentor must review their own college before call bookings can be on
-- (previously only mentors verified from 2026-09-03 on). Flag everyone, then
-- switch OFF any mentor currently "accepting calls" who has not reviewed their
-- linked college (or has no linked college, so can never review) -- they get
-- auto-enabled the moment they submit the review.
UPDATE user_profiles p
SET must_review_college = true
FROM users u
WHERE u.id = p.user_id AND u.role = 'MENTOR' AND p.must_review_college = false;

UPDATE user_profiles p
SET is_mentor_available = false, availability_set_at = now()
FROM users u
WHERE u.id = p.user_id
  AND u.role = 'MENTOR'
  AND p.is_mentor_available = true
  AND NOT EXISTS (
    SELECT 1 FROM reviews r
    WHERE r.author_id = u.id AND r.university_id = p.university_id
  );
