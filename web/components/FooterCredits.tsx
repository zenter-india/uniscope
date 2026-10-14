/**
 * Copyright + credit lines shared by every footer on the site (the home page's
 * inline footer and SiteFooter), so the wording can't drift between them.
 */
export function FooterCredits() {
  return (
    <>
      <p>© {new Date().getFullYear()} Uniscope. All Rights Reserved.</p>
      <p className="mt-1.5">Powered by AMSEL Gold</p>
      <p className="mt-1.5">
        Engineered{" "}
        <a
          href="https://astyllex.in"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-slate-600 hover:underline"
        >
          @ASTYLLEX - Technology Consulting &amp; Product Engineering
        </a>
      </p>
    </>
  );
}
