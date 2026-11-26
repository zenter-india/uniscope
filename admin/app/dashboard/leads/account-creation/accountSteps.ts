/**
 * The steps of turning a website sign-up into an account, as the backend saves
 * them when one stops. Kept in plain words here so the page shows where it
 * broke, not just a technical reason.
 */
export type AccountStep = 'account' | 'document' | 'link';

const STEPS: readonly AccountStep[] = ['account', 'document', 'link'];

/** The step the backend saved, or null for an older failure that has none (and
 * for a value this page does not know, so a newer backend never breaks it). */
export function parseStep(value: string | null | undefined): AccountStep | null {
  return STEPS.find((s) => s === value) ?? null;
}

/** What to tell the admin about a step it stopped at. */
export const STEP_COPY: Record<
  AccountStep,
  { stoppedAt: string; accountExists: boolean; outcome: string }
> = {
  account: {
    stoppedAt: 'Creating the account',
    accountExists: false,
    outcome: 'No account was created. The person has no account yet.',
  },
  document: {
    stoppedAt: 'Sending the college ID for review',
    accountExists: true,
    outcome: 'The account was created, but the college ID was not sent for review.',
  },
  link: {
    stoppedAt: 'Linking the account to this sign-up',
    accountExists: true,
    outcome: 'The account was created, but it is not linked to this sign-up yet.',
  },
};

export type TrackState = 'done' | 'failed' | 'pending';

export interface TrackItem {
  label: string;
  state: TrackState;
}

/**
 * The line of steps a sign-up goes through, marked as done, the one that
 * failed, and the ones that never ran. The college ID step is only part of the
 * line for a mentor who uploaded a document, because nobody else has one to
 * send.
 */
export function trackFor(
  stopped: AccountStep,
  opts: { role: 'ASPIRANT' | 'MENTOR'; hasDocument: boolean },
): TrackItem[] {
  const hasDocumentStep = opts.role === 'MENTOR' && opts.hasDocument;
  // The step it stopped at reads as what did not happen ("Account not
  // created"), so a cross never sits next to a label that says it worked.
  const stage = (step: AccountStep, label: string, notDone: string): TrackItem => {
    const at = STEPS.indexOf(step) - STEPS.indexOf(stopped);
    return at < 0
      ? { label, state: 'done' }
      : at === 0
        ? { label: notDone, state: 'failed' }
        : { label, state: 'pending' };
  };

  return [
    { label: 'Sign-up saved', state: 'done' },
    stage('account', 'Account created', 'Account not created'),
    ...(hasDocumentStep
      ? [stage('document', 'College ID sent for review', 'College ID not sent')]
      : []),
    stage('link', 'Linked to this sign-up', 'Not linked to this sign-up'),
  ];
}
