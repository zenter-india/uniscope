import type { SVGProps } from 'react';

/**
 * A small hand-picked set of line icons (Lucide path data, ISC-licensed),
 * inlined so the panel pulls in no icon dependency. 24×24 grid, 1.75 stroke,
 * `currentColor` — size with `className="h-4 w-4"` and colour with `text-*`.
 */

type IconProps = SVGProps<SVGSVGElement> & { title?: string };

function base({ title, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export const Icon = {
  gauge: (p: IconProps) => base({ ...p, children: <><path d="m12 14 4-4" /><path d="M3.34 19a10 10 0 1 1 17.32 0" /></> }),
  users: (p: IconProps) => base({ ...p, children: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></> }),
  building: (p: IconProps) => base({ ...p, children: <><rect width="16" height="20" x="4" y="2" rx="2" /><path d="M9 22v-4h6v4" /><path d="M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01" /></> }),
  upload: (p: IconProps) => base({ ...p, children: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M17 8l-5-5-5 5" /><path d="M12 3v12" /></> }),
  megaphone: (p: IconProps) => base({ ...p, children: <><path d="m3 11 18-5v12L3 14v-3z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" /></> }),
  shieldCheck: (p: IconProps) => base({ ...p, children: <><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></> }),
  flag: (p: IconProps) => base({ ...p, children: <><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" x2="4" y1="22" y2="15" /></> }),
  star: (p: IconProps) => base({ ...p, children: <path d="M11.5 2.8a.6.6 0 0 1 1 0l2.4 5 5.4.8a.6.6 0 0 1 .3 1l-3.9 3.8.9 5.4a.6.6 0 0 1-.9.6l-4.8-2.5-4.8 2.5a.6.6 0 0 1-.9-.6l.9-5.4L2.4 9.6a.6.6 0 0 1 .3-1l5.4-.8z" /> }),
  message: (p: IconProps) => base({ ...p, children: <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z" /> }),
  wallet: (p: IconProps) => base({ ...p, children: <><path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /><path d="M3 5v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2H5a2 2 0 0 1-2-2" /><circle cx="16" cy="12" r="1" /></> }),
  chevronRight: (p: IconProps) => base({ ...p, children: <path d="m9 18 6-6-6-6" /> }),
  chevronDown: (p: IconProps) => base({ ...p, children: <path d="m6 9 6 6 6-6" /> }),
  search: (p: IconProps) => base({ ...p, children: <><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></> }),
  external: (p: IconProps) => base({ ...p, children: <><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></> }),
  ban: (p: IconProps) => base({ ...p, children: <><circle cx="12" cy="12" r="10" /><path d="m4.9 4.9 14.2 14.2" /></> }),
  check: (p: IconProps) => base({ ...p, children: <path d="M20 6 9 17l-5-5" /> }),
  x: (p: IconProps) => base({ ...p, children: <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></> }),
  alert: (p: IconProps) => base({ ...p, children: <><path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3z" /><path d="M12 9v4M12 17h.01" /></> }),
  trendUp: (p: IconProps) => base({ ...p, children: <><path d="M16 7h6v6" /><path d="m22 7-8.5 8.5-5-5L2 17" /></> }),
  trendDown: (p: IconProps) => base({ ...p, children: <><path d="M16 17h6v-6" /><path d="m22 17-8.5-8.5-5 5L2 7" /></> }),
  clock: (p: IconProps) => base({ ...p, children: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></> }),
  refresh: (p: IconProps) => base({ ...p, children: <><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 21v-5h5" /></> }),
};

export type IconName = keyof typeof Icon;
