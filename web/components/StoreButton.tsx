import { Smartphone, Download } from "lucide-react";

const STORES = {
  ios: { caption: "Download on the", soonCaption: "Coming soon to the", name: "App Store", Icon: Smartphone },
  android: { caption: "Get it on", soonCaption: "Coming soon to", name: "Google Play", Icon: Download },
} as const;

/** A store download button. With an `href` it's a real link; without one
 * (the store listing isn't live yet) it renders as a disabled "Coming soon"
 * button instead of a link that would 404. Deliberately text-only rather
 * than the official Apple/Google badge artwork, which has its own usage
 * rules — swap the badge SVGs in here once the listings are live. */
export function StoreButton({ store, href }: { store: keyof typeof STORES; href: string }) {
  const { caption, soonCaption, name, Icon } = STORES[store];

  const inner = (
    <>
      <Icon size={26} aria-hidden="true" className="shrink-0" />
      <span className="text-left leading-tight">
        <span className="block text-[11px] font-semibold opacity-80">{href ? caption : soonCaption}</span>
        <span className="block text-[18px] font-extrabold">{name}</span>
      </span>
    </>
  );

  const base = "inline-flex items-center gap-3 rounded-[14px] px-5 py-3 min-w-[210px] justify-center sm:justify-start";

  if (!href) {
    return (
      <span
        role="link"
        aria-disabled="true"
        aria-label={`${name} — coming soon`}
        className={`${base} bg-slate-400/25 text-slate-600 cursor-not-allowed select-none`}
      >
        {inner}
      </span>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${caption} ${name}`}
      className={`${base} bg-navy-deep text-white shadow-[0_10px_24px_-10px_rgba(7,21,57,.6)] hover:bg-navy-800 hover:-translate-y-0.5 active:scale-[0.97] active:translate-y-0 transition-all`}
    >
      {inner}
    </a>
  );
}
