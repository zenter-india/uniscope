'use client';

/**
 * Tiny module-level pub/sub toast store — deliberately not React context,
 * since the dashboard's pages are independent client islands under a
 * server-rendered shell rather than one client tree, and this needs to be
 * callable from any of them (`toast.success('Saved')`) without threading a
 * provider through every page. `ToastHost` (mounted once in
 * DashboardShell) is the only subscriber that actually renders anything.
 */

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastMsg {
  id: number;
  kind: ToastKind;
  text: string;
}

const AUTO_DISMISS_MS = 4000;

let toasts: ToastMsg[] = [];
let nextId = 1;
const listeners = new Set<(toasts: ToastMsg[]) => void>();

function emit() {
  for (const l of listeners) l(toasts);
}

function push(kind: ToastKind, text: string) {
  const id = nextId++;
  toasts = [...toasts, { id, kind, text }];
  emit();
  setTimeout(() => dismissToast(id), AUTO_DISMISS_MS);
}

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function subscribeToasts(listener: (toasts: ToastMsg[]) => void): () => void {
  listeners.add(listener);
  listener(toasts);
  return () => {
    listeners.delete(listener);
  };
}

export const toast = {
  success: (text: string) => push('success', text),
  error: (text: string) => push('error', text),
  info: (text: string) => push('info', text),
};
