/**
 * Single source of truth for "can this mentor be booked for a call right now".
 *
 * `isMentorAvailable` is a mentor's own stated intent ("I'm accepting call
 * bookings"), NOT real-time presence — nothing here knows or claims whether
 * their app is open.
 *
 * It no longer expires on its own (decision 2026-10-05, replaces the old 24h
 * auto-expiry): it is switched ON automatically when a mentor finishes
 * verification AND submits their own-college review (see
 * UniversityReviewsService.create), and from then on changes only when the
 * mentor turns it off (or back on) themselves.
 *
 * Every read path (mentor list, mentor detail, the call-booking gate, and the
 * mentor's own profile screen) must go through this function.
 */

type AvailabilityFields = {
  isMentorAvailable: boolean;
  availabilitySetAt?: Date | null;
};

export function isCallAvailable(
  profile: AvailabilityFields | null | undefined,
): boolean {
  return !!profile?.isMentorAvailable;
}
