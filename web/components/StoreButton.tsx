import { Apple, Play } from "lucide-react";

const STORES = {
  ios: { caption: "Download on the", soonCaption: "Coming soon to the", name: "App Store", Icon: Apple },
  android: { caption: "Get it on", soonCaption: "Coming soon to", name: "Google Play", Icon: Play },
} as const;

/** A store download button, styled for the dark navy sections of /download.
 * With an `href` it's a real link; without one (the store listing isn't live
 * yet) it renders as a disabled "Coming soon" pill instead of a link that
 * would 404. Deliberately text + a generic glyph rather than the official
 * Apple/Google badge artwork, which has its own usage rules — swap the badge
 * SVGs in here once the listings are live. */
export function StoreButton({ store, href }: { store: keyof typeof STORES; href: string }) {
  const { caption, soonCaption, name, Icon } = STORES[store];

  const inner = (
    <>
      <Icon size={28} aria-hidden="true" className="shrink-0" fill="currentColor" strokeWidth={1.5} />
      <span className="text-left leading-tight">
        <span className="block text-[11px] font-semibold opacity-75">{href ? caption : soonCaption}</span>
        <span className="block text-[19px] font-extrabold tracking-tight">{name}</span>
      </span>
    </>
  );

  const base = "inline-flex min-w-[220px] items-center justify-center gap-3 rounded-[15px] px-5 py-3 sm:justify-start";

  if (!href) {
    return (
      <span
        role="link"
        aria-disabled="true"
        aria-label={`${name} — coming soon`}
        className={`${base} cursor-not-allowed select-none border border-white/20 bg-white/10 text-white/80 backdrop-blur`}
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
      className={`${base} bg-white text-navy-deep shadow-[0_14px_34px_-12px_rgba(0,0,0,.65)] transition-all hover:-translate-y-0.5 hover:bg-[#f1f4ff] hover:shadow-[0_20px_40px_-12px_rgba(0,0,0,.7)] active:translate-y-0 active:scale-[0.97]`}
    >
      {inner}
    </a>
  );
}
