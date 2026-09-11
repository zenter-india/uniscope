'use client';

import { useEffect, useState } from 'react';
import { Icon } from './icons';

const STORAGE_KEY = 'uniscope-admin-theme';

function apply(dark: boolean) {
  document.documentElement.classList.toggle('dark', dark);
}

/** Light/dark toggle for the header. The actual theme is applied
 * pre-paint by an inline script in `layout.tsx` (reads localStorage,
 * falls back to `prefers-color-scheme`) so there's no flash of the wrong
 * theme on load — this component just mirrors that starting state into
 * React state and lets the user flip it. */
export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Mirrors the class the pre-paint inline script (layout.tsx) already
    // applied to <html> — genuinely a one-time read of external DOM state
    // set outside React, not state derivable from props/other state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDark(document.documentElement.classList.contains('dark'));
    setMounted(true);
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    apply(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light');
    } catch {
      // Private browsing / storage disabled — theme just won't persist.
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={mounted ? (dark ? 'Switch to light mode' : 'Switch to dark mode') : 'Toggle theme'}
      title={mounted ? (dark ? 'Switch to light mode' : 'Switch to dark mode') : undefined}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
    >
      {/* Render nothing theme-specific until mounted, so SSR/hydration
       * markup matches regardless of the visitor's actual stored theme. */}
      {mounted ? dark ? <Icon.sun className="h-4 w-4" /> : <Icon.moon className="h-4 w-4" /> : (
        <span className="h-4 w-4" />
      )}
    </button>
  );
}

/** Inline script text (not JSX) — inject via `dangerouslySetInnerHTML` in
 * the root layout's `<head>` so the theme class lands before first paint.
 * Kept as a plain string (not a real .js asset) to avoid an extra network
 * request blocking render. */
export const themeInitScript = `(function(){try{var s=localStorage.getItem('${STORAGE_KEY}');var d=s?s==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;
