import Link from "next/link";
import { FooterCredits } from "./FooterCredits";

const LINKS = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms and Conditions" },
  { href: "/refund", label: "Refund and Cancellation Policy" },
  { href: "/community-guidelines", label: "Community Guidelines" },
  { href: "/download", label: "Download the App" },
];

export function SiteFooter() {
  return (
    <footer className="px-6 py-10 text-center text-[12.5px] font-semibold text-slate-400">
      <FooterCredits />
      <p className="mt-3">
        {LINKS.map((l, i) => (
          <span key={l.href}>
            {i > 0 && <span className="mx-2">·</span>}
            <Link href={l.href} className="hover:text-slate-600 hover:underline">
              {l.label}
            </Link>
          </span>
        ))}
      </p>
    </footer>
  );
}
