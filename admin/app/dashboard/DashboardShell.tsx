'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LogoutButton } from '../../components/LogoutButton';
import { GlobalSearch } from '../../components/GlobalSearch';
import { ToastHost } from '../../components/ToastHost';
import { ThemeToggle } from '../../components/ThemeToggle';
import { Icon, type IconName } from '../../components/icons';

const NAV_SECTIONS: {
  heading: string;
  items: { label: string; href: string; icon: IconName }[];
}[] = [
  {
    heading: 'Operations',
    items: [
      { label: 'Overview', href: '/dashboard', icon: 'gauge' },
      { label: 'Leads', href: '/dashboard/leads', icon: 'users' },
      { label: 'Verification', href: '/dashboard/verification', icon: 'shieldCheck' },
      { label: 'Moderation', href: '/dashboard/moderation', icon: 'flag' },
      { label: 'Reviews', href: '/dashboard/reviews', icon: 'star' },
      { label: 'Sessions', href: '/dashboard/sessions', icon: 'message' },
      { label: 'Payouts', href: '/dashboard/payouts', icon: 'wallet' },
      { label: 'Support', href: '/dashboard/support', icon: 'lifebuoy' },
      { label: 'Announcements', href: '/dashboard/broadcasts', icon: 'megaphone' },
    ],
  },
  {
    heading: 'Directory',
    items: [
      { label: 'Users', href: '/dashboard/users', icon: 'users' },
      { label: 'Universities', href: '/dashboard/universities', icon: 'building' },
      { label: 'Data Import', href: '/dashboard/data-import', icon: 'upload' },
    ],
  },
  {
    heading: 'Admin',
    items: [
      { label: 'Admins', href: '/dashboard/admins', icon: 'lock' },
      { label: 'Health', href: '/dashboard/health', icon: 'heartPulse' },
      { label: 'Integrations', href: '/dashboard/integrations', icon: 'activity' },
      { label: 'Settings', href: '/dashboard/settings', icon: 'settings' },
    ],
  },
];

function isActive(pathname: string, href: string) {
  return href === '/dashboard'
    ? pathname === '/dashboard'
    : pathname === href || pathname.startsWith(`${href}/`);
}

function NavSections({
  pathname,
  onNavigate,
  touch = false,
}: {
  pathname: string;
  onNavigate?: () => void;
  /** Larger rows for the mobile drawer (≥44px tap targets). */
  touch?: boolean;
}) {
  return (
    <>
      {NAV_SECTIONS.map((section) => (
        <div key={section.heading}>
          <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            {section.heading}
          </p>
          <div className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const active = isActive(pathname, item.href);
              const IconCmp = Icon[item.icon];
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-2.5 rounded-md px-2 text-sm transition-colors ${
                    touch ? 'min-h-11 py-2.5' : 'py-1.5'
                  } ${
                    active
                      ? 'bg-zinc-100 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                      : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100'
                  }`}
                >
                  <IconCmp
                    className={`h-4 w-4 shrink-0 ${
                      active ? 'text-zinc-700 dark:text-zinc-300' : 'text-zinc-400 dark:text-zinc-500'
                    }`}
                  />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}

function Brand() {
  return (
    <>
      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-zinc-900 text-[11px] font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">
        U
      </span>
      <span className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        Uniscope
      </span>
      <span className="text-sm text-zinc-400 dark:text-zinc-500">Admin</span>
    </>
  );
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
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  // Phone navigation is a slide-in drawer (menu button in the header)
  // instead of a scrolling strip of 16 tabs: it fits every section on
  // screen at once, has real tap targets, and carries search + sign-out
  // that the cramped header can't. Escape closes it, and the page behind
  // doesn't scroll while it's open.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [menuOpen]);

  return (
    <div className="flex min-h-screen">
      <ToastHost />
      <aside className="hidden w-60 shrink-0 flex-col border-r border-zinc-200 bg-white md:flex dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex h-14 items-center gap-2 border-b border-zinc-200 px-5 dark:border-zinc-800">
          <Brand />
        </div>
        <nav className="flex flex-1 flex-col gap-6 overflow-y-auto p-3">
          <NavSections pathname={pathname} />
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-2 border-b border-zinc-200 bg-white/85 px-3 shadow-[0_1px_2px_rgb(0_0_0/0.03)] backdrop-blur sm:px-5 dark:border-zinc-800 dark:bg-zinc-900/85">
          <div className="flex min-w-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              aria-expanded={menuOpen}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-zinc-600 hover:bg-zinc-100 md:hidden dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <Icon.menu className="h-5 w-5" />
            </button>
            <h1 className="truncate text-[15px] font-semibold text-zinc-900 dark:text-zinc-100">{title}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <GlobalSearch />
            {email ? (
              <span className="hidden text-xs text-zinc-500 lg:inline dark:text-zinc-400">{email}</span>
            ) : null}
            <ThemeToggle />
            {/* Below sm, sign-out lives in the menu drawer. */}
            <div className="hidden sm:block">
              <LogoutButton />
            </div>
          </div>
        </header>

        {menuOpen && (
          <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
            <button
              type="button"
              aria-label="Close menu"
              onClick={closeMenu}
              className="absolute inset-0 bg-black/40"
            />
            <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-200 pl-5 pr-2 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <Brand />
                </div>
                <button
                  type="button"
                  onClick={closeMenu}
                  aria-label="Close menu"
                  className="flex h-11 w-11 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  <Icon.x className="h-5 w-5" />
                </button>
              </div>
              <div className="shrink-0 border-b border-zinc-200 p-3 dark:border-zinc-800">
                <GlobalSearch fullWidth onNavigate={closeMenu} />
              </div>
              <nav className="flex flex-1 flex-col gap-5 overflow-y-auto p-3">
                <NavSections pathname={pathname} onNavigate={closeMenu} touch />
              </nav>
              <div className="shrink-0 space-y-2 border-t border-zinc-200 p-3 dark:border-zinc-800">
                {email ? (
                  <p className="truncate px-1 text-xs text-zinc-500 dark:text-zinc-400">{email}</p>
                ) : null}
                <LogoutButton />
              </div>
            </div>
          </div>
        )}

        <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-8">{children}</main>
      </div>
    </div>
  );
}
