'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogoutButton } from '../../components/LogoutButton';

const NAV_ITEMS = [
  { label: 'Overview', href: '/dashboard' },
  { label: 'Verification Queue', href: '/dashboard/verification' },
  { label: 'Moderation', href: '/dashboard/moderation' },
  { label: 'Users', href: '/dashboard/users' },
  { label: 'Universities', href: '/dashboard/universities' },
];

export function DashboardShell({
  title,
  email,
  children,
}: {
  title: string;
  email: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

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
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-2 text-sm ${
                  active
                    ? 'bg-zinc-900 font-medium text-white'
                    : 'text-zinc-600 hover:bg-zinc-100'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
          <h1 className="text-lg font-semibold text-zinc-900">{title}</h1>
          <div className="flex items-center gap-4">
            {email ? <span className="text-sm text-zinc-500">{email}</span> : null}
            <LogoutButton />
          </div>
        </header>

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
