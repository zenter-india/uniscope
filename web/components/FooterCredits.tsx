/**
 * Copyright + credit rows shared by every footer on the site (the home page's
 * inline footer and SiteFooter), so the wording and layout can't drift.
 *
 * Bottom row: © on the left, "Engineered" credit on the right (stacked and
 * centered on narrow screens); "Powered by" centered on its own line last.
 */
export function FooterCredits() {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-col items-center gap-1.5 sm:flex-row sm:justify-between">
        <p>© {new Date().getFullYear()} Uniscope. All Rights Reserved.</p>
        <p>
          Engineered{" "}
          <a
            href="https://astyllex.in"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-slate-600 hover:underline"
          >
            @ASTYLLEX
          </a>
        </p>
      </div>
      <p className="mt-3">Powered by AMSEL Gold</p>
    </div>
  );
}
