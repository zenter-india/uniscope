import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import SignOutButton from '@/components/SignOutButton';

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect('/login');

  return (
    <main className="min-h-screen bg-zinc-50">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
        <div>
          <h1 className="text-lg font-bold text-zinc-900">Uniscope Admin</h1>
          <p className="text-xs text-zinc-500">{session.user?.email}</p>
        </div>
        <SignOutButton />
      </header>

      <div className="mx-auto max-w-6xl p-6">
        <h2 className="text-xl font-semibold text-zinc-800">Dashboard</h2>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Pending Verifications', value: '—', href: '/dashboard/verifications' },
            { label: 'Total Users', value: '—', href: '/dashboard/users' },
            { label: 'Universities', value: '—', href: '/dashboard/universities' },
            { label: 'Open Reports', value: '—', href: '/dashboard/reports' },
          ].map((card) => (
            <a
              key={card.label}
              href={card.href}
              className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-200 hover:ring-emerald-400 transition-all"
            >
              <p className="text-sm text-zinc-500">{card.label}</p>
              <p className="mt-1 text-3xl font-bold text-zinc-900">{card.value}</p>
            </a>
          ))}
        </div>

        <div className="mt-8 rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
          <h3 className="font-semibold text-zinc-800">Queues (coming soon)</h3>
          <p className="mt-2 text-sm text-zinc-500">
            Verification review, moderation, and user management queues will appear here in Week 2.
          </p>
        </div>
      </div>
    </main>
  );
}
