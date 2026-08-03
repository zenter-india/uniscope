/**
 * Single source of truth for "can this mentor be booked for a call right now".
 *
 * `isMentorAvailable` is a mentor's own stated intent ("I'm accepting call
 * bookings"), NOT real-time presence — nothing here knows or claims whether
 * their app is open. See docs/decisions: real presence was deliberately not
 * built, because a call is booked asynchronously (request → mentor accepts →
 * they connect later), so "is their app open this second" isn't the question
 * the booking flow asks.
 *
 * The one thing we do correct for is staleness: a mentor who switches on and
 * forgets would otherwise advertise availability indefinitely, and a student
 * paying for a slot against a three-day-old signal is a refund waiting to
 * happen. So availability expires on its own after AVAILABILITY_TTL_HOURS.
 *
 * Every read path (mentor list, mentor detail, the call-booking gate, and the
 * mentor's own profile screen) must go through this function — if the student
 * and the mentor disagree about whether they're bookable, that's a support
 * ticket.
 */

export const AVAILABILITY_TTL_HOURS = 24;

const TTL_MS = AVAILABILITY_TTL_HOURS * 60 * 60 * 1000;

type AvailabilityFields = {
  isMentorAvailable: boolean;
  availabilitySetAt: Date | null;
};

/** True only if the mentor opted in AND that opt-in hasn't gone stale. A null
 * timestamp counts as expired — the migration backfills existing available
 * mentors precisely so that case means "never switched on", not "legacy row". */
export function isCallAvailable(
  profile: AvailabilityFields | null | undefined,
): boolean {
  if (!profile?.isMentorAvailable) return false;
  if (!profile.availabilitySetAt) return false;
  return Date.now() - profile.availabilitySetAt.getTime() < TTL_MS;
}
