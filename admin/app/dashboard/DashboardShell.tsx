'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
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
      { label: 'Integrations', href: '/dashboard/integrations', icon: 'activity' },
      { label: 'Settings', href: '/dashboard/settings', icon: 'settings' },
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
  const mobileNavRef = useRef<HTMLDivElement>(null);
  const activeItemRef = useRef<HTMLAnchorElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // The mobile nav strip is a bare horizontally-scrollable row with no
  // visual hint that more tabs exist off-screen — a page whose own nav
  // item sits past the fold (e.g. "Admins"/"Integrations", near the end
  // of a 12-item list) leaves the active-tab highlight invisible with no
  // indication you need to scroll to find it. Two fixes: scroll the
  // active item into view on every navigation, and fade the edges
  // whenever there's unscrolled content in that direction.
  useEffect(() => {
    activeItemRef.current?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [pathname]);

  useEffect(() => {
    const el = mobileNavRef.current;
    if (!el) return;
    const updateFades = () => {
      setCanScrollLeft(el.scrollLeft > 4);
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    };
    updateFades();
    el.addEventListener('scroll', updateFades, { passive: true });
    window.addEventListener('resize', updateFades);
    return () => {
      el.removeEventListener('scroll', updateFades);
      window.removeEventListener('resize', updateFades);
    };
  }, []);

  return (
    <div className="flex min-h-screen">
      <ToastHost />
      <aside className="hidden w-60 shrink-0 flex-col border-r border-zinc-200 bg-white md:flex dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex h-14 items-center gap-2 border-b border-zinc-200 px-5 dark:border-zinc-800">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-zinc-900 text-[11px] font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">
            U
          </span>
          <span className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Uniscope
          </span>
          <span className="text-sm text-zinc-400 dark:text-zinc-500">Admin</span>
        </div>
        <nav className="flex flex-1 flex-col gap-6 overflow-y-auto p-3">
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
                      aria-current={active ? 'page' : undefined}
                      className={`flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors ${
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
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-zinc-200 bg-white/85 px-5 shadow-[0_1px_2px_rgb(0_0_0/0.03)] backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/85">
          <h1 className="truncate text-[15px] font-semibold text-zinc-900 dark:text-zinc-100">{title}</h1>
          <div className="flex items-center gap-3">
            <GlobalSearch />
            {email ? (
              <span className="hidden text-xs text-zinc-500 lg:inline dark:text-zinc-400">{email}</span>
            ) : null}
            <ThemeToggle />
            <LogoutButton />
          </div>
        </header>

        {/* Mobile nav strip — relative wrapper so the edge fades can be
            absolutely positioned over the scrollable row without affecting
            its layout. */}
        <div className="relative border-b border-zinc-200 bg-white md:hidden dark:border-zinc-800 dark:bg-zinc-900">
          <div ref={mobileNavRef} className="flex gap-1 overflow-x-auto px-3 py-2">
            {ALL_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  ref={active ? activeItemRef : undefined}
                  href={item.href}
                  className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-medium ${
                    active
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                      : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
          {/* Fade hints — only shown on the side that actually has more
              content to scroll to, so a fully-scrolled edge doesn't keep
              suggesting there's somewhere further to go. */}
          {canScrollLeft && (
            <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-white to-transparent dark:from-zinc-900" />
          )}
          {canScrollRight && (
            <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-white to-transparent dark:from-zinc-900" />
          )}
        </div>

        <main className="mx-auto w-full max-w-6xl flex-1 p-5 sm:p-8">{children}</main>
      </div>
    </div>
  );
}
