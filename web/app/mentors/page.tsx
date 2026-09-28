import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, EyeOff, GraduationCap, Layers } from "lucide-react";
import { SiteNav } from "../../components/SiteNav";
import { SiteFooter } from "../../components/SiteFooter";
import { PageHero } from "../../components/PageHero";
import { Reveal } from "../../components/Reveal";
import { RoleTrigger } from "../../components/RoleTrigger";
import { DownloadBand } from "../../components/DownloadBand";

export const metadata: Metadata = {
  title: "Talk to mentors — Uniscope",
  description:
    "Uniscope mentors are current students and alumni who answer honestly about hostels, faculty, placements and campus life. Chat or book a call in the app.",
};

const WHO = [
  {
    icon: GraduationCap,
    title: "Students and alumni",
    body: "People studying there now, or who graduated recently enough to remember exactly how it felt.",
  },
  {
    icon: BadgeCheck,
    title: "Look for the Verified badge",
    body: "It means we've checked the mentor's college ID, so you know they really were there.",
  },
  {
    icon: EyeOff,
    title: "Private by design",
    body: "Everyone chats under a display name. Mentors' real names are never shown to anyone.",
  },
  {
    icon: Layers,
    title: "Across streams",
    body: "Medical, Dental, Engineering, Law, Design and more — find someone from your field.",
  },
];

const QUESTIONS = [
  "Is there any toxicity?",
  "How's the curriculum?",
  "How's the placement support?",
  "How's the hands-on experience?",
  "How's life outside college?",
  "Will I fit in there?",
  "How are the hostels and food?",
  "How heavy is the workload?",
];

export default function MentorsPage() {
  return (
    <>
      <SiteNav />
      <main>
        <PageHero
          eyebrow="Mentors"
          title="Talk to people who’ve"
          accent="been where you’re headed."
          intro="Uniscope mentors are current students and alumni from colleges across India. They tell you what it’s really like — the kind of answers a brochure never gives."
        >
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/download"
              className="inline-flex items-center gap-2 rounded-[12px] bg-white px-6 py-3 text-[15px] font-extrabold text-navy-deep shadow-[0_14px_34px_-12px_rgba(0,0,0,.6)] transition-all hover:-translate-y-0.5 hover:bg-[#f1f4ff] active:scale-[0.97]"
            >
              Get the app <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <RoleTrigger
              role="mentor"
              className="inline-flex items-center rounded-[12px] border-[1.5px] border-white/40 px-6 py-3 text-[15px] font-bold text-white transition-all hover:bg-white/10 active:scale-[0.97]"
            >
              Become a mentor
            </RoleTrigger>
          </div>
        </PageHero>

        <section className="px-6 py-20">
          <div className="mx-auto max-w-[1000px]">
            <Reveal className="mx-auto max-w-[560px] text-center">
              <p className="text-[12.5px] font-extrabold uppercase tracking-wide text-blue-600">Who you&rsquo;ll meet</p>
              <h2 className="mt-2 text-[clamp(26px,3.6vw,36px)] font-extrabold leading-tight text-ink text-balance">
                Real people, not brochures
              </h2>
            </Reveal>
            <div className="mt-12 grid gap-4 sm:grid-cols-2">
              {WHO.map(({ icon: Icon, title, body }, i) => (
                <Reveal key={title} delay={(i % 2) * 90}>
                  <div className="h-full rounded-[20px] border border-border bg-surface p-6 shadow-[0_12px_30px_-22px_rgba(16,27,59,.3)]">
                    <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-linear-to-br from-blue-600 to-blue-500 text-white shadow-[0_10px_22px_-10px_rgba(33,72,201,.7)]">
                      <Icon size={22} aria-hidden="true" />
                    </span>
                    <h3 className="mt-4 text-[17px] font-extrabold text-ink">{title}</h3>
                    <p className="mt-1.5 text-[14.5px] leading-relaxed text-slate-600">{body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="px-6 pb-20">
          <div className="mx-auto max-w-[860px] rounded-[26px] bg-surface p-8 text-center shadow-[0_20px_50px_-30px_rgba(16,27,59,.3)] border border-border md:p-12">
            <Reveal>
              <p className="text-[12.5px] font-extrabold uppercase tracking-wide text-gold-600">Ask anything</p>
              <h2 className="mt-2 text-[clamp(24px,3.2vw,32px)] font-extrabold leading-tight text-ink text-balance">
                The questions students actually ask
              </h2>
              <ul className="mt-7 flex flex-wrap justify-center gap-2.5">
                {QUESTIONS.map((q) => (
                  <li
                    key={q}
                    className="rounded-full border border-border bg-[#f8f9fc] px-4 py-2 text-[14px] font-semibold text-slate-600"
                  >
                    {q}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </section>

        <section className="px-6 pb-20">
          <Reveal className="mx-auto grid max-w-[1000px] gap-5 md:grid-cols-2">
            <Link
              href="/colleges"
              className="group rounded-[22px] border border-border bg-surface p-7 shadow-[0_16px_36px_-24px_rgba(16,27,59,.25)] transition-all hover:-translate-y-1 hover:border-blue-600/30"
            >
              <h3 className="text-[19px] font-extrabold text-ink">Start with your college</h3>
              <p className="mt-2 text-[14.5px] leading-relaxed text-slate-600">
                Search the colleges you&rsquo;re considering, then find people from them in the app.
              </p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-[14px] font-extrabold text-blue-600">
                Explore colleges
                <ArrowRight size={16} aria-hidden="true" className="transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
            <div className="rounded-[22px] border border-border bg-[#fbf6ea] p-7">
              <h3 className="text-[19px] font-extrabold text-ink">Studied there yourself?</h3>
              <p className="mt-2 text-[14.5px] leading-relaxed text-slate-600">
                Currently studying or graduated &mdash; guide aspirants and turn your experience into income.
              </p>
              <RoleTrigger
                role="mentor"
                className="mt-4 inline-flex items-center gap-1.5 text-[14px] font-extrabold text-gold-600 hover:text-gold-500"
              >
                Become a mentor <ArrowRight size={16} aria-hidden="true" />
              </RoleTrigger>
            </div>
          </Reveal>
        </section>

        <DownloadBand
          title="Ready to ask?"
          accent="Get the app."
          body="Chat with a mentor, or book a live audio call, straight from your phone."
        />
      </main>
      <SiteFooter />
    </>
  );
}
