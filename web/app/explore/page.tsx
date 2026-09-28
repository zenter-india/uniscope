import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Compass, Smartphone, Users } from "lucide-react";
import { SiteNav } from "../../components/SiteNav";
import { SiteFooter } from "../../components/SiteFooter";
import { PageHero } from "../../components/PageHero";
import { Reveal } from "../../components/Reveal";
import { HowItWorks } from "../../components/HowItWorks";
import { DownloadBand } from "../../components/DownloadBand";

export const metadata: Metadata = {
  title: "Explore Uniscope",
  description:
    "Look up colleges, learn how Uniscope mentors work, and get the app to talk to students and alumni before you choose a college.",
};

const TILES = [
  {
    href: "/colleges",
    icon: Compass,
    title: "Explore colleges",
    body: "Search colleges across India by name, stream and level.",
    cta: "Find your college",
  },
  {
    href: "/mentors",
    icon: Users,
    title: "Talk to mentors",
    body: "Meet the students and alumni who answer honestly about campus life.",
    cta: "See how mentors work",
  },
  {
    href: "/download",
    icon: Smartphone,
    title: "Get the app",
    body: "Chat with mentors or book a live call, right from your phone.",
    cta: "Download Uniscope",
  },
];

export default function ExplorePage() {
  return (
    <>
      <SiteNav />
      <main>
        <PageHero
          eyebrow="Explore Uniscope"
          title="Everything you need to"
          accent="choose your college."
          intro="Look up colleges, find out how mentors work, and get the app when you’re ready to ask the people who are already there."
        />

        <section className="px-6 py-20">
          <div className="mx-auto grid max-w-[1000px] gap-5 md:grid-cols-3">
            {TILES.map(({ href, icon: Icon, title, body, cta }, i) => (
              <Reveal key={href} delay={i * 100}>
                <Link
                  href={href}
                  className="group flex h-full flex-col rounded-[22px] border border-border bg-surface p-7 shadow-[0_16px_36px_-24px_rgba(16,27,59,.25)] transition-all duration-200 hover:-translate-y-1.5 hover:border-blue-600/30 hover:shadow-[0_24px_48px_-24px_rgba(33,72,201,.35)]"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-linear-to-br from-blue-600 to-blue-500 text-white shadow-[0_10px_22px_-10px_rgba(33,72,201,.7)] transition-transform duration-200 group-hover:scale-110">
                    <Icon size={22} aria-hidden="true" />
                  </span>
                  <h2 className="mt-5 text-[19px] font-extrabold text-ink">{title}</h2>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-slate-600">{body}</p>
                  <span className="mt-auto inline-flex items-center gap-1.5 pt-5 text-[14px] font-extrabold text-blue-600">
                    {cta}
                    <ArrowRight size={16} aria-hidden="true" className="transition-transform group-hover:translate-x-1" />
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </section>

        <HowItWorks />

        <DownloadBand />
      </main>
      <SiteFooter />
    </>
  );
}
