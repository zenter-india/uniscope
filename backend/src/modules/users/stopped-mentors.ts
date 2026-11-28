import { UserRole, VerificationStatus, type Prisma } from '@prisma/client';
import { toCsv } from '../money/money-csv.js';

/**
 * Mentors who have an account but whose verification is still Draft: they never
 * submitted a college ID. It is the same list the Users page shows when you
 * pick Mentor and Draft, except erased (deleted) accounts, which are not people
 * anyone can follow up with. One definition, used by the list, the count and
 * the CSV, so they always agree.
 */
export const STOPPED_MENTOR_WHERE = {
  role: UserRole.MENTOR,
  verificationStatus: VerificationStatus.DRAFT,
  deletedAt: null,
} satisfies Prisma.UserWhereInput;

/** Just the columns the list needs. */
export const STOPPED_MENTOR_SELECT = {
  id: true,
  displayName: true,
  phoneEncrypted: true,
  createdAt: true,
  lastActiveAt: true,
  profile: {
    select: {
      realNameEncrypted: true,
      stream: true,
      state: true,
      city: true,
      qualification: true,
      university: { select: { name: true } },
    },
  },
} satisfies Prisma.UserSelect;

export type StoppedMentorRow = Prisma.UserGetPayload<{
  select: typeof STOPPED_MENTOR_SELECT;
}>;

/**
 * Where a mentor stopped in the app's six-step sign-up (basic information,
 * location, college details, current status, avatar, college ID). The app keeps
 * steps 1 to 4 on the phone and saves the profile to the server only when step 4
 * ends, so the server can tell two places apart and no more:
 *  - 'profile'      the profile was never saved: they stopped somewhere in
 *                   steps 1 to 4 (we cannot tell which);
 *  - 'verification' the profile is saved, the college ID was not submitted:
 *                   they stopped at step 5 or 6, or tapped "Skip for now".
 */
export type LeftAt = 'profile' | 'verification';

/** The four answers the wizard saves together at the end of step 4. */
export function profileSaved(
  profile: {
    stream: string | null;
    state: string | null;
    city: string | null;
    qualification: string | null;
  } | null,
): boolean {
  return Boolean(
    profile?.stream && profile.state && profile.city && profile.qualification,
  );
}

export function leftAtOf(profile: Parameters<typeof profileSaved>[0]): LeftAt {
  return profileSaved(profile) ? 'verification' : 'profile';
}

/** The same two places in plain words, for the admin page and the CSV. */
export const LEFT_AT_TEXT: Record<LeftAt, { short: string; detail: string }> = {
  profile: {
    short: 'Steps 1 to 4 (profile not saved)',
    detail:
      'The app saves the profile only when step 4 is finished, so we cannot tell which of basic information, location, college details or current status they stopped at.',
  },
  verification: {
    short: 'Step 5 or 6 (profile saved, college ID not submitted)',
    detail:
      'They finished steps 1 to 4. They stopped at the avatar or the college ID, or tapped "Skip for now".',
  },
};

export interface StoppedMentorResponse {
  id: string;
  /** The auto-generated or chosen alias. */
  displayName: string;
  /** Only once the profile was saved. */
  realName: string | null;
  /** The number we hold for them, when we hold one. */
  phone: string | null;
  college: string | null;
  degree: string | null;
  stream: string | null;
  createdAt: Date;
  lastActiveAt: Date | null;
  /** 'website' when the account was made from a website sign-up. */
  source: 'website' | 'app';
  leftAt: LeftAt;
}

export function toStoppedMentor(
  row: StoppedMentorRow,
  extra: {
    realName: string | null;
    phone: string | null;
    fromWebsite: boolean;
  },
): StoppedMentorResponse {
  const p = row.profile;
  return {
    id: row.id,
    displayName: row.displayName,
    realName: extra.realName,
    phone: extra.phone,
    college: p?.university?.name ?? null,
    degree: p?.qualification ?? null,
    stream: p?.stream ?? null,
    createdAt: row.createdAt,
    lastActiveAt: row.lastActiveAt,
    source: extra.fromWebsite ? 'website' : 'app',
    leftAt: leftAtOf(p),
  };
}

/** A phone number in "+" and digits only. These are written as they are so
 * whoever opens the file can copy and dial them; any other text that starts with
 * "+" is still guarded against running as a spreadsheet formula. */
const isPlainPhone = (text: string): boolean => /^\+\d{6,15}$/.test(text);

/** The list as a spreadsheet, for follow-up outside the admin panel. */
export function stoppedMentorsCsv(
  rows: readonly StoppedMentorResponse[],
): string {
  return toCsv(
    rows,
    [
      ['Signed up', (r) => r.createdAt.toISOString()],
      ['Last active', (r) => r.lastActiveAt?.toISOString()],
      ['Name', (r) => r.realName],
      ['Alias', (r) => r.displayName],
      ['Phone', (r) => r.phone],
      ['Signed up from', (r) => (r.source === 'website' ? 'Website' : 'App')],
      ['Left at', (r) => LEFT_AT_TEXT[r.leftAt].short],
      ['College', (r) => r.college],
      ['Degree', (r) => r.degree],
      ['Stream', (r) => r.stream],
    ],
    isPlainPhone,
  );
}
