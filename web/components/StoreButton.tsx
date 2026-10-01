/** The real Apple logo (Simple Icons, CC0). Takes the button's text colour so
 * it reads on both the dark "coming soon" pill and the white live button. */
function AppleLogo() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" className="shrink-0" fill="currentColor">
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  );
}

/** The real Google Play logo: the four-colour triangle, in Google's brand
 * colours (fixed, so it looks the same on the dark and white buttons). */
function PlayLogo() {
  return (
    <svg viewBox="30 336.7 120.9 129.2" width="26" height="28" aria-hidden="true" className="shrink-0">
      <path fill="#FFCE00" d="M119.2,421.2c15.3-8.4,27-14.8,28-15.3c3.2-1.7,6.5-6.2,0-9.7 c-2.1-1.1-13.4-7.3-28-15.3l-20.1,20.2L119.2,421.2z" />
      <path fill="#FF3A44" d="M99.1,401.1l-64.2,64.7c1.5,0.2,3.2-0.2,5.2-1.3 c4.2-2.3,48.8-26.7,79.1-43.3L99.1,401.1L99.1,401.1z" />
      <path fill="#00F076" d="M99.1,401.1l20.1-20.2c0,0-74.6-40.7-79.1-43.1 c-1.7-1-3.6-1.3-5.3-1L99.1,401.1z" />
      <path fill="#00C3FF" d="M99.1,401.1l-64.3-64.3c-2.6,0.6-4.8,2.9-4.8,7.6 c0,7.5,0,107.5,0,113.8c0,4.3,1.7,7.4,4.9,7.7L99.1,401.1z" />
    </svg>
  );
}

const STORES = {
  ios: { caption: "Download on the", soonCaption: "Coming soon to the", name: "App Store", Icon: AppleLogo },
  android: { caption: "Get it on", soonCaption: "Coming soon to", name: "Google Play", Icon: PlayLogo },
} as const;

/** A store download button, styled for the dark navy sections of /download.
 * With an `href` it's a real link; without one (the store listing isn't live
 * yet) it renders as a disabled "Coming soon" pill instead of a link that
 * would 404. Uses the real Apple and Google Play logos with our own button
 * styling — not the official "Download on the App Store" / "Get it on Google
 * Play" badge artwork, which has its own usage rules; swap those badge SVGs
 * in here once the listings are live if you want them. */
export function StoreButton({
  store,
  href,
  tone = "dark",
}: {
  store: keyof typeof STORES;
  href: string;
  /** "dark" for the navy sections; "light" for white page sections. */
  tone?: "dark" | "light";
}) {
  const { caption, soonCaption, name, Icon } = STORES[store];

  const inner = (
    <>
      <Icon />
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
        className={`${base} cursor-not-allowed select-none ${
          tone === "light"
            ? "border border-navy-deep/15 bg-white text-navy-deep shadow-[0_6px_18px_-10px_rgba(7,21,57,.35)]"
            : "border border-white/20 bg-white/10 text-white/80 backdrop-blur"
        }`}
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
      className={`${base} transition-all hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] ${
        tone === "light"
          ? "bg-navy-deep text-white shadow-[0_14px_30px_-12px_rgba(7,21,57,.6)] hover:bg-navy-800"
          : "bg-white text-navy-deep shadow-[0_14px_34px_-12px_rgba(0,0,0,.65)] hover:bg-[#f1f4ff] hover:shadow-[0_20px_40px_-12px_rgba(0,0,0,.7)]"
      }`}
    >
      {inner}
    </a>
  );
}
