import { toneFor } from '../components/ui';

/**
 * What the admin shows in the "verification" badge for a user.
 *
 * `verificationStatus` is DRAFT for every new account, and only mentors ever
 * move off it (by submitting a document). Showing the raw value made two
 * ordinary cases read like a problem:
 *  - an abandoned signup — the account is created at OTP verification, before
 *    the onboarding wizard asks anything, so quitting midway leaves a DRAFT
 *    account with an empty profile ("Profile incomplete");
 *  - an aspirant who finished onboarding — aspirants are never verified
 *    ("Not required").
 * Every other status is shown as it is.
 */
export function accountStatus(user: {
  role: string;
  verificationStatus: string;
  /** Absent on a backend that predates the flag — then the raw status shows. */
  profileIncomplete?: boolean;
}): { label: string; tone: ReturnType<typeof toneFor>; raw: boolean } {
  if (user.verificationStatus === 'DRAFT') {
    if (user.profileIncomplete === true) {
      return { label: 'Profile incomplete', tone: 'neutral', raw: false };
    }
    if (user.role === 'ASPIRANT') {
      return { label: 'Not required', tone: 'neutral', raw: false };
    }
  }
  return {
    label: user.verificationStatus,
    tone: toneFor(user.verificationStatus),
    raw: true,
  };
}
