import { Reveal } from "./Reveal";
import { NAVY_GLOW } from "./DownloadBand";

/** The navy header band shared by the menu pages (Explore / Mentors /
 * Colleges) — same look as the /download hero, without the phone. */
export function PageHero({
  eyebrow,
  title,
  accent,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  accent?: string;
  intro: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="relative overflow-hidden bg-navy-deep px-6 pb-14 pt-14 text-center text-white md:pb-16 md:pt-20" style={{ backgroundImage: NAVY_GLOW }}>
      <Reveal className="mx-auto max-w-[760px]">
        <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-[12.5px] font-bold text-sky-300">
          {eyebrow}
        </span>
        <h1 className="mt-5 text-[clamp(30px,5vw,52px)] font-extrabold leading-[1.08] text-balance">
          {title}
          {accent && <span className="block text-gold-400">{accent}</span>}
        </h1>
        <p className="mx-auto mt-4 max-w-[600px] text-[16px] leading-relaxed text-white/75 text-balance">{intro}</p>
        {children}
      </Reveal>
    </section>
  );
}
