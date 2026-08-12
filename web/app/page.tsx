import Link from "next/link";
import { SiteNav } from "../components/SiteNav";
import { HeroCold } from "../components/HeroCold";
import { HeroWarm } from "../components/HeroWarm";
import { ClosingCta } from "../components/ClosingCta";
import { GetStarted } from "../components/GetStarted";

export default function HomePage() {
  return (
    <>
      <SiteNav />
      <HeroCold />
      <HeroWarm />
      <ClosingCta />
      <GetStarted />
      <footer className="px-6 py-10 text-center text-[12.5px] font-semibold text-slate-400">
        <p>© {new Date().getFullYear()} Uniscope. Real Insights. Real Mentors. Real Guidance.</p>
        <Link href="/privacy" className="mt-1.5 inline-block hover:text-slate-600 hover:underline">
          Privacy Policy
        </Link>
      </footer>
    </>
  );
}
