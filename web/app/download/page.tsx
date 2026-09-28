import type { Metadata } from "next";
import Link from "next/link";
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
import { Reveal } from "../../components/Reveal";
import { RoleTrigger } from "../../components/RoleTrigger";
import { GetStarted } from "../../components/GetStarted";
import { StoreButton } from "../../components/StoreButton";
import { PhoneMockup } from "../../components/PhoneMockup";
import { DownloadQr } from "../../components/DownloadQr";
import { APP_STORE_URL, PLAY_STORE_URL } from "../../lib/app-links";

export const metadata: Metadata = {
  title: "Download the Uniscope app — iPhone & Android",
  description:
    "Don't guess your college — ask someone who's studying there. Chat with students and alumni on the Uniscope app for iPhone and Android.",
};

const STEPS = [
  {
    n: "1",
    title: "Download & sign in",
    body: "Verify your phone number with a one-time code. No passwords to remember.",
  },
  {
    n: "2",
    title: "Find your mentors",
    body: "Browse by college, stream and degree — including the exact college you're considering.",
  },
  {
    n: "3",
    title: "Ask anything",
    body: "Start a chat, or book a live audio call in 6, 10 or 20-minute slots when you want a proper conversation.",
  },
];

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

const HERO_BG =
  "radial-gradient(60% 55% at 78% 30%, rgba(46,91,232,.42), transparent 70%), radial-gradient(45% 45% at 8% 95%, rgba(221,176,90,.16), transparent 70%)";

/** Centered until `leftFrom`, then left-aligned — the hero switches to two
 * columns at `lg`, the closing band at `md`. */
function Stores({ leftFrom }: { leftFrom: "md" | "lg" }) {
  return (
    <div
      className={`flex flex-col items-center gap-3.5 sm:flex-row sm:flex-wrap sm:justify-center ${
        leftFrom === "lg" ? "lg:justify-start" : "md:justify-start"
      }`}
    >
      <StoreButton store="ios" href={APP_STORE_URL} />
      <StoreButton store="android" href={PLAY_STORE_URL} />
    </div>
  );
}

export default function DownloadPage() {
  const storesLive = Boolean(APP_STORE_URL && PLAY_STORE_URL);

  return (
    <>
      <SiteNav />
      <main>
        {/* Hero */}
        <section className="relative overflow-hidden bg-navy-deep text-white" style={{ backgroundImage: HERO_BG }}>
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

        {/* How it works */}
        <section className="px-6 py-20">
          <div className="mx-auto max-w-[1000px]">
            <Reveal className="mx-auto max-w-[560px] text-center">
              <p className="text-[12.5px] font-extrabold uppercase tracking-wide text-blue-600">How it works</p>
              <h2 className="mt-2 text-[clamp(26px,3.6vw,36px)] font-extrabold leading-tight text-ink text-balance">
                From download to real answers in three steps
              </h2>
            </Reveal>
            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <Reveal key={s.n} delay={i * 100}>
                  <div className="h-full rounded-[22px] border border-border bg-surface p-7 shadow-[0_16px_36px_-24px_rgba(16,27,59,.25)]">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-linear-to-br from-gold-400 to-gold-600 text-[18px] font-extrabold text-white shadow-[0_10px_22px_-8px_rgba(180,132,42,.7)]">
                      {s.n}
                    </span>
                    <h3 className="mt-5 text-[18px] font-extrabold text-ink">{s.title}</h3>
                    <p className="mt-2 text-[14.5px] leading-relaxed text-slate-600">{s.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

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

        {/* Closing call to action */}
        <section
          className="relative overflow-hidden bg-navy-deep px-6 py-20 text-white"
          style={{ backgroundImage: HERO_BG }}
        >
          <div className="mx-auto grid max-w-[1000px] items-center gap-10 md:grid-cols-[1fr_auto]">
            <Reveal className="text-center md:text-left">
              <h2 className="text-[clamp(26px,3.8vw,40px)] font-extrabold leading-tight text-balance">
                Your future is too important to guess.
                <span className="block text-gold-400">Uniscope it.</span>
              </h2>
              <p className="mx-auto mt-4 max-w-[480px] text-[15.5px] leading-relaxed text-white/75 md:mx-0">
                Get the app and hear from the people who&rsquo;ve already been where you&rsquo;re headed.
              </p>
              <div className="mt-7">
                <Stores leftFrom="md" />
              </div>
            </Reveal>

            <Reveal delay={150} className="hidden md:block">
              <div className="rounded-[24px] bg-white p-4 text-center shadow-[0_30px_60px_-24px_rgba(0,0,0,.7)]">
                <DownloadQr className="h-[148px] w-[148px]" />
                <p className="mt-3 text-[12.5px] font-extrabold text-ink">Scan with your phone</p>
                <p className="text-[11.5px] font-semibold text-slate-600">to get the app</p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Same registration section as the home page — also makes the nav's
            Sign up / Log in buttons work on this page, since they scroll to
            #get-started. */}
        <GetStarted />
      </main>

      <footer className="px-6 py-10 text-center text-[12.5px] font-semibold text-slate-400">
        <p>© {new Date().getFullYear()} Uniscope. Real Insights. Real Mentors. Real Guidance.</p>
        <p className="mt-1.5">
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
