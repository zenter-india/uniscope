import Link from 'next/link';
import { notFound } from 'next/navigation';
import { backendFetch, BackendApiError } from '../../../../lib/backend';
import { getAdminEmail } from '../../../../lib/adminAuth';
import { DashboardShell } from '../../DashboardShell';
import { BanToggle, VerificationDocButton } from './interactive';
import { EditUserPanel } from './EditUserPanel';
import { WalletPanel } from './WalletPanel';
import type { LedgerPage } from './actions';

interface AdminUserDetail {
  id: string;
  displayName: string;
  realName: string | null;
  role: 'ASPIRANT' | 'MENTOR' | 'ADMIN';
  verificationStatus: string;
  isActive: boolean;
  isBanned: boolean;
  lastActiveAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  avatarUrl: string | null;
  profile: {
    dateOfBirth: string | null;
    gender: string | null;
    state: string | null;
    city: string | null;
    university: { id: string; name: string; slug: string } | null;
    qualification: string | null;
    stream: string | null;
    specialization: string | null;
    courseInterested: string | null;
    yearOfStudy: number | null;
    graduationYear: number | null;
    yearInfoPrivate: boolean;
    goals: string[];
    preferredLanguage: string | null;
    preferredMentorshipTiming: string | null;
    bio: string | null;
    specialty: string | null;
    languages: string[];
    availableDays: string[];
    isMentorAvailable: boolean;
    isMentorAvailableRaw: boolean;
    availabilitySetAt: string | null;
    pricePerMinuteMinor: number | null;
    freeChatsRemaining: number;
    freeCallSecondsRemaining: number;
    createdAt: string;
    updatedAt: string;
  } | null;
  wallet: { balanceMinor: number } | null;
  verificationRequests: Array<{
    id: string;
    documentType: string;
    status: string;
    reviewNote: string | null;
    reviewerName: string | null;
    universityName: string | null;
    hasDocument: boolean;
    submittedAt: string | null;
    reviewedAt: string | null;
    createdAt: string;
  }>;
  activity: {
    sessionsAsAspirant: number;
    sessionsAsMentor: number;
    reportsFiled: number;
    reportsAgainst: number;
    mentorReviewsReceived: number;
    universityReviewsWritten: number;
  };
}

const VERIFICATION_COLORS: Record<string, string> = {
  VERIFIED: 'bg-emerald-100 text-emerald-700',
  SUBMITTED: 'bg-amber-100 text-amber-700',
  UNDER_REVIEW: 'bg-amber-100 text-amber-700',
  REJECTED: 'bg-red-100 text-red-700',
  SUSPENDED: 'bg-red-100 text-red-700',
  DRAFT: 'bg-zinc-100 text-zinc-600',
};

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  STUDENT_ID: 'Student ID card',
  STUDENT_PORTAL_SCREENSHOT: 'Student portal screenshot',
  DEGREE_CERTIFICATE: 'Degree certificate',
  NMC_REGISTRATION: 'Registration certificate',
};

function fmtDate(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function fmtDateOnly(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
}

function ageFrom(dob: string | null): string {
  if (!dob) return '';
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age > 0 && age < 120 ? ` (age ${age})` : '';
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  const empty =
    value === null ||
    value === undefined ||
    value === '' ||
    (Array.isArray(value) && value.length === 0);
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">{label}</p>
      <p className="mt-0.5 text-sm text-zinc-800">
        {empty ? <span className="text-zinc-300">—</span> : value}
      </p>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5">
      <h2 className="mb-4 text-sm font-semibold text-zinc-900">{title}</h2>
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">{children}</div>
    </section>
  );
}

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [email, user, ledger] = await Promise.all([
    getAdminEmail(),
    backendFetch<AdminUserDetail>(`/users/${id}`).catch((e) => {
      if (e instanceof BackendApiError && e.status === 404) return null;
      throw e;
    }),
    backendFetch<LedgerPage>(`/wallet/admin/${id}/ledger?limit=15`).catch(
      () => null,
    ),
  ]);

  if (!user) notFound();

  const p = user.profile;
  const balanceMinor = user.wallet?.balanceMinor ?? 0;
  const freeCallMins = p ? Math.floor(p.freeCallSecondsRemaining / 60) : 0;
  const freeCallSecs = p ? p.freeCallSecondsRemaining % 60 : 0;

  return (
    <DashboardShell title={user.displayName} email={email}>
      <Link
        href="/dashboard/users"
        className="mb-4 inline-block text-sm text-zinc-500 hover:text-zinc-800"
      >
        ← Back to users
      </Link>

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-5">
        <div className="flex items-start gap-4">
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatarUrl}
              alt=""
              className="h-16 w-16 rounded-full border border-zinc-200 bg-zinc-50"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 text-lg font-semibold text-zinc-400">
              {user.displayName.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-lg font-semibold text-zinc-900">{user.displayName}</p>
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                {user.role}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  VERIFICATION_COLORS[user.verificationStatus] ?? 'bg-zinc-100 text-zinc-600'
                }`}
              >
                {user.verificationStatus}
              </span>
              {user.isBanned && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                  Banned
                </span>
              )}
              {!user.isActive && !user.isBanned && (
                <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-600">
                  Deleted account
                </span>
              )}
            </div>
            {user.realName && (
              <p className="mt-1 text-sm text-zinc-600">
                Real name: <span className="font-medium text-zinc-900">{user.realName}</span>
              </p>
            )}
            <p className="mt-1 text-xs text-zinc-400">
              Joined {fmtDate(user.createdAt)} · Last active {fmtDate(user.lastActiveAt)}
            </p>
            <p className="mt-0.5 font-mono text-xs text-zinc-300">{user.id}</p>
          </div>
        </div>
        {user.role !== 'ADMIN' && (
          <BanToggle userId={user.id} isBanned={user.isBanned} />
        )}
      </div>

      <div className="flex flex-col gap-4">
        {p && user.role !== 'ADMIN' && (
          <EditUserPanel
            user={{
              id: user.id,
              displayName: user.displayName,
              role: user.role,
              verificationStatus: user.verificationStatus,
              realName: user.realName,
              dateOfBirth: p.dateOfBirth,
              gender: p.gender,
              state: p.state,
              city: p.city,
              qualification: p.qualification,
              stream: p.stream,
              specialization: p.specialization,
              courseInterested: p.courseInterested,
              yearOfStudy: p.yearOfStudy,
              graduationYear: p.graduationYear,
              yearInfoPrivate: p.yearInfoPrivate,
              bio: p.bio,
              specialty: p.specialty,
              languages: p.languages,
              availableDays: p.availableDays,
              goals: p.goals,
              preferredLanguage: p.preferredLanguage,
              preferredMentorshipTiming: p.preferredMentorshipTiming,
              isMentorAvailable: p.isMentorAvailableRaw,
              freeChatsRemaining: p.freeChatsRemaining,
              freeCallSecondsRemaining: p.freeCallSecondsRemaining,
            }}
          />
        )}

        <Section title="Identity">
          <Field label="Display name / alias" value={user.displayName} />
          <Field label="Real name" value={user.realName} />
          <Field
            label="Date of birth"
            value={p?.dateOfBirth ? `${fmtDateOnly(p.dateOfBirth)}${ageFrom(p.dateOfBirth)}` : null}
          />
          <Field label="Gender" value={p?.gender} />
        </Section>

        <Section title="Location">
          <Field label="State" value={p?.state} />
          <Field label="City" value={p?.city} />
        </Section>

        <Section title="Academic">
          <Field
            label="College / University"
            value={
              p?.university ? (
                <Link
                  href={`/dashboard/universities?search=${encodeURIComponent(p.university.name)}`}
                  className="text-zinc-900 underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-600"
                >
                  {p.university.name}
                </Link>
              ) : null
            }
          />
          <Field label="Stream / Field" value={p?.stream} />
          <Field label="Qualification / Degree" value={p?.qualification} />
          <Field label="Specialization" value={p?.specialization} />
          <Field label="Course interested" value={p?.courseInterested} />
          <Field
            label="Year of study"
            value={p?.yearOfStudy ? `Year ${p.yearOfStudy}` : null}
          />
          <Field label="Graduation year" value={p?.graduationYear} />
          <Field
            label="Year info private"
            value={p ? (p.yearInfoPrivate ? 'Yes' : 'No') : null}
          />
          <Field label="Goals / target exams" value={p?.goals.join(', ')} />
        </Section>

        <Section title="Preferences">
          <Field label="Preferred language" value={p?.preferredLanguage} />
          <Field label="Preferred mentorship timing" value={p?.preferredMentorshipTiming} />
        </Section>

        <Section title="Mentor profile">
          <Field
            label="Accepting call bookings"
            value={
              p
                ? p.isMentorAvailable
                  ? 'Yes'
                  : p.isMentorAvailableRaw
                    ? 'Toggle on, but expired (24h)'
                    : 'No'
                : null
            }
          />
          <Field label="Availability set at" value={fmtDate(p?.availabilitySetAt)} />
          <Field
            label="Rate per minute"
            value={
              p?.pricePerMinuteMinor != null
                ? `₹${(p.pricePerMinuteMinor / 100).toFixed(2)}`
                : null
            }
          />
          <Field label="Specialty" value={p?.specialty} />
          <Field label="Languages spoken" value={p?.languages.join(', ')} />
          <Field label="Available days" value={p?.availableDays.join(', ')} />
          <div className="col-span-2 sm:col-span-3">
            <Field label="Bio" value={p?.bio} />
          </div>
        </Section>

        <WalletPanel
          userId={user.id}
          initialBalanceMinor={ledger?.balanceMinor ?? balanceMinor}
          initialEntries={ledger?.data ?? []}
          initialCursor={ledger?.nextCursor ?? null}
        />

        <Section title="Free tier">
          <Field
            label="Free chats remaining"
            value={p ? String(p.freeChatsRemaining) : null}
          />
          <Field
            label="Free call time remaining"
            value={p ? `${freeCallMins}m ${freeCallSecs}s` : null}
          />
        </Section>

        <Section title="Activity">
          <Field label="Sessions as aspirant" value={String(user.activity.sessionsAsAspirant)} />
          <Field label="Sessions as mentor" value={String(user.activity.sessionsAsMentor)} />
          <Field label="Reports filed by user" value={String(user.activity.reportsFiled)} />
          <Field label="Reports against user" value={String(user.activity.reportsAgainst)} />
          <Field
            label="Mentor reviews received"
            value={String(user.activity.mentorReviewsReceived)}
          />
          <Field
            label="College reviews written"
            value={String(user.activity.universityReviewsWritten)}
          />
        </Section>

        <section className="rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-zinc-900">
            Verification requests ({user.verificationRequests.length})
          </h2>
          {user.verificationRequests.length === 0 ? (
            <p className="text-sm text-zinc-400">No verification requests submitted.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {user.verificationRequests.map((r) => (
                <div key={r.id} className="rounded-lg border border-zinc-100 bg-zinc-50 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        VERIFICATION_COLORS[r.status] ?? 'bg-zinc-100 text-zinc-600'
                      }`}
                    >
                      {r.status}
                    </span>
                    <span className="text-sm font-medium text-zinc-800">
                      {DOCUMENT_TYPE_LABELS[r.documentType] ?? r.documentType}
                    </span>
                    <span className="text-sm text-zinc-500">
                      {r.universityName ?? '—'}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
                    <Field label="Submitted" value={fmtDate(r.submittedAt)} />
                    <Field label="Reviewed" value={fmtDate(r.reviewedAt)} />
                    <Field label="Reviewer" value={r.reviewerName} />
                    <div className="col-span-2 sm:col-span-3">
                      <Field label="Review note" value={r.reviewNote} />
                    </div>
                  </div>
                  {r.hasDocument && (
                    <div className="mt-3">
                      <VerificationDocButton requestId={r.id} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <Section title="Record metadata">
          <Field label="User ID" value={<span className="font-mono text-xs">{user.id}</span>} />
          <Field label="Account created" value={fmtDate(user.createdAt)} />
          <Field label="Account updated" value={fmtDate(user.updatedAt)} />
          <Field label="Profile created" value={fmtDate(p?.createdAt)} />
          <Field label="Profile updated" value={fmtDate(p?.updatedAt)} />
          <Field label="Deleted at" value={fmtDate(user.deletedAt)} />
        </Section>
      </div>
    </DashboardShell>
  );
}
