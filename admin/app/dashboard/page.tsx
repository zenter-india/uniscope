import { cookies } from 'next/headers';
import { LogoutButton } from '../../components/LogoutButton';
import { SESSION_COOKIE, verifySessionToken } from '../../lib/session';

// Sidebar items are placeholders for moderation tooling shipped in later sprints.
const NAV_ITEMS = [
  { label: 'Overview', active: true },
  { label: 'Verification Queue', active: false },
  { label: 'Moderation', active: false },
  { label: 'Users', active: false },
  { label: 'Universities', active: false },
];

const STAT_CARDS = [
  { label: 'Pending verifications', hint: 'Wired in a later sprint' },
  { label: 'Open reports', hint: 'Wired in a later sprint' },
  { label: 'Active users', hint: 'Wired in a later sprint' },
];

export default async function DashboardPage() {
  const secret = process.env.ADMIN_SESSION_SECRET ?? '';
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const email = await verifySessionToken(token, secret);

  return (
    <div className="flex min-h-screen bg-zinc-50">
      <aside className="hidden w-60 flex-col border-r border-zinc-200 bg-white p-4 sm:flex">
        <div className="mb-6 px-2">
          <span className="text-lg font-bold tracking-tight text-zinc-900">
            Uniscope
          </span>
          <span className="ml-1 text-sm text-zinc-400">Admin</span>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <span
              key={item.label}
              className={`rounded-lg px-3 py-2 text-sm ${
                item.active
                  ? 'bg-zinc-900 font-medium text-white'
                  : 'text-zinc-600'
              }`}
            >
              {item.label}
            </span>
          ))}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
          <h1 className="text-lg font-semibold text-zinc-900">Overview</h1>
          <div className="flex items-center gap-4">
            {email ? (
              <span className="text-sm text-zinc-500">{email}</span>
            ) : null}
            <LogoutButton />
          </div>
        </header>

        <main className="flex-1 p-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {STAT_CARDS.map((card) => (
              <div
                key={card.label}
                className="rounded-xl border border-zinc-200 bg-white p-5"
              >
                <p className="text-sm font-medium text-zinc-700">{card.label}</p>
                <p className="mt-2 text-3xl font-bold text-zinc-300">—</p>
                <p className="mt-1 text-xs text-zinc-400">{card.hint}</p>
              </div>
            ))}
          </div>

          <p className="mt-8 text-sm text-zinc-500">
            Admin portal foundation. Moderation and verification tooling arrive
            in later sprints.
          </p>
        </main>
      </div>
    </div>
  );
}
