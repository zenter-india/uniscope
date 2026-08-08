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
        © {new Date().getFullYear()} Uniscope. See it. Hear it. Live it.
      </footer>
    </>
  );
}
