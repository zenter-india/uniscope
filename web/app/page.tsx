import Link from "next/link";
import { SiteNav } from "../components/SiteNav";
import { HeroCold } from "../components/HeroCold";
import { HeroWarm } from "../components/HeroWarm";
import { ClosingCta } from "../components/ClosingCta";
import { GetStarted } from "../components/GetStarted";
import { FooterCredits } from "../components/FooterCredits";

export default function HomePage() {
  return (
    <>
      <SiteNav />
      <HeroCold />
      <HeroWarm />
      <ClosingCta />
      <GetStarted />
      <footer className="px-6 py-10 text-center text-[12.5px] font-semibold text-slate-400">
        <FooterCredits />
        <p className="mt-3">
          <Link href="/privacy" className="hover:text-slate-600 hover:underline">
            Privacy Policy
          </Link>
          <span className="mx-2">·</span>
          <Link href="/terms" className="hover:text-slate-600 hover:underline">
            Terms and Conditions
          </Link>
          <span className="mx-2">·</span>
          <Link href="/refund" className="hover:text-slate-600 hover:underline">
            Refund and Cancellation Policy
          </Link>
          <span className="mx-2">·</span>
          <Link href="/community-guidelines" className="hover:text-slate-600 hover:underline">
            Community Guidelines
          </Link>
        </p>
      </footer>
    </>
  );
}
