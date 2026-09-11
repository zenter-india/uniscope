'use client';

import { useEffect, useState } from 'react';
import { dismissToast, subscribeToasts, type ToastMsg } from '../lib/toast';
import { Icon } from './icons';

const STYLES: Record<ToastMsg['kind'], string> = {
  success:
    'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-500/10 dark:text-emerald-300',
  error:
    'border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-500/10 dark:text-red-300',
  info: 'border-zinc-200 bg-white text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200',
};

/** Mounted once in DashboardShell. Renders whatever `toast.success/error/info`
 * (lib/toast.ts) has pushed, top-right, auto-dismissing after 4s. */
export function ToastHost() {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  useEffect(() => subscribeToasts(setToasts), []);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-80 flex-col gap-2">
      {toasts.map((t) => {
        const IconCmp = t.kind === 'success' ? Icon.check : t.kind === 'error' ? Icon.alert : null;
        return (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-2 rounded-lg border px-3.5 py-2.5 text-sm shadow-lg ${STYLES[t.kind]}`}
          >
            {IconCmp && <IconCmp className="mt-0.5 h-4 w-4 shrink-0" />}
            <span className="flex-1">{t.text}</span>
            <button
              onClick={() => dismissToast(t.id)}
              aria-label="Dismiss"
              className="shrink-0 opacity-60 hover:opacity-100"
            >
              <Icon.x className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
