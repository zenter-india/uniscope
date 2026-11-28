import Link from 'next/link';
import { Badge, Card } from '../../../../components/ui';
import { StepTrack } from './StepTrack';
import { LEFT_AT_COPY, leftTrack, type LeftAt } from './stoppedMentors';

/** One mentor who has an account but never submitted a college ID. Dates arrive
 * already formatted by the server page. */
export interface StoppedMentor {
  id: string;
  /** The alias (auto-generated unless they chose one). */
  displayName: string;
  /** Only once the profile was saved. */
  realName: string | null;
  phone: string | null;
  college: string | null;
  degree: string | null;
  signedUp: string;
  lastActive: string | null;
  source: 'website' | 'app';
  leftAt: LeftAt | null;
}

export function StoppedMentorRow({ mentor }: { mentor: StoppedMentor }) {
  const details = [
    mentor.phone ?? 'No phone number stored',
    [mentor.college, mentor.degree].filter(Boolean).join(', ') || null,
    `signed up ${mentor.signedUp}`,
    mentor.lastActive ? `last active ${mentor.lastActive}` : 'never active since signing up',
  ].filter(Boolean);

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium text-zinc-900 dark:text-zinc-100">
          {mentor.realName ?? mentor.displayName}
        </span>
        <Badge tone="info">Mentor</Badge>
        <Badge tone="neutral">
          {mentor.source === 'website' ? 'Website sign-up' : 'App sign-up'}
        </Badge>
      </div>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        {mentor.realName ? `alias: ${mentor.displayName} · ` : ''}
        {details.join(' · ')}
      </p>

      {mentor.leftAt ? (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
            Left at: {LEFT_AT_COPY[mentor.leftAt].title}
          </p>
          <p className="mt-0.5 text-sm text-amber-900 dark:text-amber-200">
            {LEFT_AT_COPY[mentor.leftAt].detail}
          </p>
          <StepTrack items={leftTrack(mentor.leftAt)} label="Mentor sign-up steps" />
        </div>
      ) : (
        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
          Where they stopped could not be worked out.
        </p>
      )}

      <div className="mt-3">
        <Link
          href={`/dashboard/users/${mentor.id}`}
          className="text-xs text-zinc-500 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          Open user
        </Link>
      </div>
    </Card>
  );
}
