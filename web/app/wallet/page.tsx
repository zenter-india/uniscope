import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "../../components/SiteNav";
import { SiteFooter } from "../../components/SiteFooter";
import { WalletTopup } from "../../components/WalletTopup";

export const metadata: Metadata = {
  title: "Buy Uniminutes — Uniscope",
  description:
    "Top up your Uniscope wallet with Uniminutes, then use them for mentor calls in the Uniscope app on iOS and Android.",
  // A login-and-pay tool, not content: keep it out of search results.
  robots: { index: false, follow: false },
};

export default function WalletPage() {
  return (
    <>
      <SiteNav />
      <main className="px-4 sm:px-6 py-12 sm:py-14">
        <div className="max-w-[760px] mx-auto">
          <Link href="/" className="inline-block mb-5 text-[13.5px] font-bold text-blue-600 hover:underline">
            ← Back to home
          </Link>
          <p className="text-[12.5px] font-extrabold uppercase tracking-wide text-blue-600">Wallet</p>
          <h1 className="mt-2 text-[clamp(26px,4vw,36px)] font-extrabold text-ink text-wrap-balance">
            Buy Uniminutes
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-slate-600">
            Top up here, then call mentors from the Uniscope app on iOS or Android. Your balance is
            the same everywhere.
          </p>
          <div className="mt-8">
            <WalletTopup />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
