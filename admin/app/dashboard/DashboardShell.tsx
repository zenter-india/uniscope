'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogoutButton } from '../../components/LogoutButton';

const NAV_SECTIONS: { heading: string; items: { label: string; href: string }[] }[] = [
  {
    heading: 'Operations',
    items: [
      { label: 'Overview', href: '/dashboard' },
      { label: 'Leads', href: '/dashboard/leads' },
      { label: 'Verification', href: '/dashboard/verification' },
      { label: 'Moderation', href: '/dashboard/moderation' },
      { label: 'Reviews', href: '/dashboard/reviews' },
      { label: 'Sessions', href: '/dashboard/sessions' },
      { label: 'Payouts', href: '/dashboard/payouts' },
    ],
  },
  {
    heading: 'Directory',
    items: [
      { label: 'Users', href: '/dashboard/users' },
      { label: 'Universities', href: '/dashboard/universities' },
      { label: 'Data Import', href: '/dashboard/data-import' },
    ],
  },
];

const ALL_ITEMS = NAV_SECTIONS.flatMap((s) => s.items);

function isActive(pathname: string, href: string) {
  return href === '/dashboard'
    ? pathname === '/dashboard'
    : pathname === href || pathname.startsWith(`${href}/`);
}

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
    <div className="flex min-h-screen">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-zinc-200 bg-white md:flex">
        <div className="flex h-14 items-center gap-1.5 border-b border-zinc-200 px-5">
          <span className="text-sm font-semibold tracking-tight text-zinc-900">Uniscope</span>
          <span className="text-sm text-zinc-400">Admin</span>
        </div>
        <nav className="flex flex-1 flex-col gap-5 overflow-y-auto p-3">
          {NAV_SECTIONS.map((section) => (
            <div key={section.heading}>
              <p className="px-2 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                {section.heading}
              </p>
              <div className="flex flex-col gap-0.5">
                {section.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`rounded-md px-2 py-1.5 text-sm transition-colors ${
                        active
                          ? 'bg-zinc-100 font-medium text-zinc-900'
                          : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-zinc-200 bg-white/90 px-5 backdrop-blur">
          <h1 className="truncate text-[15px] font-semibold text-zinc-900">{title}</h1>
          <div className="flex items-center gap-3">
            {email ? (
              <span className="hidden text-xs text-zinc-500 sm:inline">{email}</span>
            ) : null}
            <LogoutButton />
          </div>
        </header>

        {/* Mobile nav strip */}
        <div className="flex gap-1 overflow-x-auto border-b border-zinc-200 bg-white px-3 py-2 md:hidden">
          {ALL_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-medium ${
                  active ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        <main className="mx-auto w-full max-w-6xl flex-1 p-5 sm:p-8">{children}</main>
      </div>
    </div>
  );
}
