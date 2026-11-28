import type { TrackItem } from './accountSteps';

/**
 * Where a mentor stopped in the app's six-step sign-up (basic information,
 * location, college details, current status, avatar, college ID). The app saves
 * the profile only when step 4 is finished, so the server can tell two places
 * apart and no more.
 */
export type LeftAt = 'profile' | 'verification';

/** The value the backend sent, or null for one this page does not know, so a
 * newer backend never breaks it. */
export function parseLeftAt(value: string | null | undefined): LeftAt | null {
  return value === 'profile' || value === 'verification' ? value : null;
}

export const LEFT_AT_COPY: Record<LeftAt, { title: string; detail: string }> = {
  profile: {
    title: 'Steps 1 to 4 (profile not saved)',
    detail:
      'The app saves the profile only when step 4 is finished, so we cannot tell which of basic information, location, college details or current status they stopped at. The Users page calls this "Profile incomplete".',
  },
  verification: {
    title: 'Step 5 or 6 (profile saved, college ID not submitted)',
    detail:
      'They finished steps 1 to 4. They stopped at the avatar or the college ID, or tapped "Skip for now".',
  },
};

/** The six steps grouped as far as the server can tell them apart. */
export function leftTrack(leftAt: LeftAt): TrackItem[] {
  return leftAt === 'profile'
    ? [
        { label: 'Profile not saved (steps 1 to 4)', state: 'failed' },
        { label: 'Avatar (step 5)', state: 'pending' },
        { label: 'College ID (step 6)', state: 'pending' },
      ]
    : [
        { label: 'Profile saved (steps 1 to 4)', state: 'done' },
        { label: 'Avatar and college ID not finished (steps 5 and 6)', state: 'failed' },
      ];
}
