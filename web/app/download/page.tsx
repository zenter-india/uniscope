import type { Metadata } from "next";
import {
  BadgeCheck,
  Compass,
  EyeOff,
  MessageCircle,
  PhoneCall,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
} from "lucide-react";
import { SiteNav } from "../../components/SiteNav";
import { SiteFooter } from "../../components/SiteFooter";
import { Reveal } from "../../components/Reveal";
import { RoleTrigger } from "../../components/RoleTrigger";
import { GetStarted } from "../../components/GetStarted";
import { Stores } from "../../components/Stores";
import { PhoneMockup } from "../../components/PhoneMockup";
import { HowItWorks } from "../../components/HowItWorks";
import { DownloadBand, NAVY_GLOW } from "../../components/DownloadBand";
import { APP_STORE_URL, PLAY_STORE_URL } from "../../lib/app-links";

export const metadata: Metadata = {
  title: "Download the Uniscope app — iPhone & Android",
  description:
    "Don't guess your college — ask someone who's studying there. Chat with students and alumni on the Uniscope app for iPhone and Android.",
};

const FEATURES = [
  {
    icon: BadgeCheck,
    title: "Verified mentors",
    body: "Mentors are current students and alumni. The Verified badge means we've checked their college ID.",
  },
  {
    icon: MessageCircle,
    title: "Ask before you decide",
    body: "Hostels, faculty, workload, placements, campus life — straight from someone who's been through it.",
  },
  {
    icon: PhoneCall,
    title: "One-on-one calls",
    body: "When a chat isn't enough, book a live audio call with a mentor in simple fixed slots.",
  },
  {
    icon: Star,
    title: "Honest college reviews",
    body: "Anonymous reviews from verified students and alumni — the good and the not-so-good.",
  },
  {
    icon: Compass,
    title: "Discover colleges",
    body: "Explore colleges across streams, with their districts, degrees and specialisations in one place.",
  },
  {
    icon: ShieldCheck,
    title: "Private by design",
    body: "You chat under a display name, and mentors' real names are never shown to anyone.",
  },
];

const TRUST = [
  { icon: Smartphone, text: "Sign in with just your phone number" },
  { icon: EyeOff, text: "Chat anonymously" },
  { icon: Sparkles, text: "Free to download" },
];

export default function DownloadPage() {
  // At least one store live is enough to drop the "register on the web
  // instead" nudge — once a real download button exists for any platform,
  // "the store listings are on their way" is no longer an accurate framing
  // for this page's primary CTA. Each StoreButton already shows its own
  // "Coming soon" state individually for whichever platform isn't live yet.
  const storesLive = Boolean(APP_STORE_URL || PLAY_STORE_URL);

  return (
    <>
      <SiteNav />
      <main>
        {/* Hero */}
        <section className="relative overflow-hidden bg-navy-deep text-white" style={{ backgroundImage: NAVY_GLOW }}>
          <div className="mx-auto grid max-w-[1180px] items-center gap-14 px-6 pb-20 pt-14 md:pb-24 md:pt-20 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,.92fr)]">
            <div className="text-center lg:text-left">
              <Reveal>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-[12.5px] font-bold text-sky-300">
                  <Sparkles size={14} aria-hidden="true" />
                  Uniscope for iPhone &amp; Android
                </span>
                <h1 className="mt-5 text-[clamp(34px,5.4vw,58px)] font-extrabold leading-[1.05] text-balance">
                  Don&rsquo;t guess your college.
                  <span className="block text-gold-400">Ask someone who&rsquo;s studying there.</span>
                </h1>
                <p className="mx-auto mt-5 max-w-[540px] text-[16.5px] leading-relaxed text-white/75 lg:mx-0">
                  Chat with real students and alumni from the colleges you&rsquo;re considering. Honest answers about
                  hostels, faculty, placements and campus life &mdash; before you make the biggest decision of your
                  year.
                </p>
              </Reveal>

              <Reveal delay={120}>
                <div className="mt-8">
                  <Stores leftFrom="lg" />
                </div>
                {!storesLive && (
                  <p className="mx-auto mt-5 max-w-[520px] text-[14px] font-semibold leading-relaxed text-white/70 lg:mx-0">
                    The store listings are on their way.{" "}
                    {/* No `role`: a generic "register" link shouldn't presume student vs
                        mentor — omitting it lands on the role picker, like the nav does. */}
                    <RoleTrigger className="font-extrabold text-gold-400 underline underline-offset-4 hover:text-gold-500">
                      Register on the web now
                    </RoleTrigger>{" "}
                    and your account will be waiting in the app &mdash; just verify the same phone number.
                  </p>
                )}
                <ul className="mt-7 flex flex-wrap justify-center gap-x-6 gap-y-2.5 lg:justify-start">
                  {TRUST.map(({ icon: Icon, text }) => (
                    <li key={text} className="flex items-center gap-2 text-[13px] font-semibold text-white/80">
                      <Icon size={16} aria-hidden="true" className="text-sky-300" />
                      {text}
                    </li>
                  ))}
                </ul>
              </Reveal>
            </div>

            <Reveal delay={200}>
              <PhoneMockup />
            </Reveal>
          </div>
        </section>

        <HowItWorks />

        {/* What's inside */}
        <section className="px-6 pb-20">
          <div className="mx-auto max-w-[1100px]">
            <Reveal className="mx-auto max-w-[560px] text-center">
              <p className="text-[12.5px] font-extrabold uppercase tracking-wide text-blue-600">Inside the app</p>
              <h2 className="mt-2 text-[clamp(26px,3.6vw,36px)] font-extrabold leading-tight text-ink text-balance">
                Everything you need to choose with confidence
              </h2>
            </Reveal>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, body }, i) => (
                <Reveal key={title} delay={(i % 3) * 90}>
                  <div className="group h-full rounded-[20px] border border-border bg-surface p-6 transition-all duration-200 hover:-translate-y-1.5 hover:border-blue-600/30 hover:shadow-[0_24px_48px_-24px_rgba(33,72,201,.35)]">
                    <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-linear-to-br from-blue-600 to-blue-500 text-white shadow-[0_10px_22px_-10px_rgba(33,72,201,.7)] transition-transform duration-200 group-hover:scale-110">
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

        <DownloadBand />

        {/* Same registration section as the home page — also makes the nav's
            Sign up / Log in buttons work on this page, since they scroll to
            #get-started. */}
        <GetStarted />
      </main>

      <SiteFooter />
    </>
  );
}
