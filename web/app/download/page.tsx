import type { Metadata } from "next";
import Link from "next/link";
import { MessageCircle, PhoneCall, Star, BadgeCheck } from "lucide-react";
import { SiteNav } from "../../components/SiteNav";
import { Reveal } from "../../components/Reveal";
import { StoreButton } from "../../components/StoreButton";
import { APP_STORE_URL, PLAY_STORE_URL } from "../../lib/app-links";

export const metadata: Metadata = {
  title: "Download the Uniscope app — iPhone & Android",
  description:
    "Get Uniscope on your phone. Talk to verified students and alumni before you choose a college — on iPhone and Android.",
};

const FEATURES = [
  {
    icon: BadgeCheck,
    title: "Verified mentors",
    body: "Mentors are current students and alumni. The Verified badge means we've checked their college ID — real people, not brochures.",
  },
  {
    icon: MessageCircle,
    title: "Chat before you decide",
    body: "Ask about campus life, faculty, hostels and placements straight from someone who's been through it.",
  },
  {
    icon: PhoneCall,
    title: "One-on-one calls",
    body: "Book a live audio call with a mentor when a chat isn't enough — in simple 6, 10 or 20-minute slots.",
  },
  {
    icon: Star,
    title: "Honest college reviews",
    body: "Anonymous reviews written by verified students and alumni — the good and the not-so-good.",
  },
];

export default function DownloadPage() {
  return (
    <>
      <SiteNav />
      <main>
        <section className="px-6 pt-14 pb-12 sm:pt-20 text-center">
          <div className="max-w-[720px] mx-auto">
            <Reveal>
              <p className="text-[12.5px] font-extrabold uppercase tracking-wide text-blue-600">Get the app</p>
              <h1 className="mt-3 text-[clamp(30px,5vw,48px)] font-extrabold leading-[1.1] text-ink text-wrap-balance">
                Take Uniscope
                <span className="block text-gold-600">everywhere you go.</span>
              </h1>
              <p className="mt-4 text-[16px] leading-relaxed text-slate-600 max-w-[560px] mx-auto text-wrap-balance">
                Real answers from real students and alumni, right on your phone. Free to download on iPhone and
                Android.
              </p>
            </Reveal>

            <Reveal delay={120}>
              <div className="mt-8 flex flex-col sm:flex-row gap-3.5 justify-center items-center">
                <StoreButton store="ios" href={APP_STORE_URL} />
                <StoreButton store="android" href={PLAY_STORE_URL} />
              </div>
              {(!APP_STORE_URL || !PLAY_STORE_URL) && (
                <p className="mt-4 text-[13px] font-semibold text-slate-400">
                  We&rsquo;re putting the finishing touches on the store listings — check back very soon.
                </p>
              )}
            </Reveal>
          </div>
        </section>

        <section className="px-6 pb-16">
          <div className="max-w-[980px] mx-auto grid gap-4 sm:grid-cols-2">
            {FEATURES.map(({ icon: Icon, title, body }, i) => (
              <Reveal key={title} delay={i * 80}>
                <div className="h-full rounded-2xl bg-surface border border-border p-6 shadow-[0_8px_24px_-16px_rgba(16,27,59,.18)]">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-[11px] bg-[#eef3ff] text-blue-600">
                    <Icon size={20} aria-hidden="true" />
                  </span>
                  <h2 className="mt-4 text-[17px] font-extrabold text-ink">{title}</h2>
                  <p className="mt-1.5 text-[14.5px] leading-relaxed text-slate-600">{body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>
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
