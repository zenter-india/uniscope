import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

// Fetched and self-hosted by Next.js at build time (no runtime request to
// Google) — see globals.css for why Manrope specifically: it's the mobile
// app's brand face. Weights match what the page actually uses.
const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-manrope",
  display: "swap",
});

const TITLE = "Uniscope — Real Insights. Real Mentors. Real Guidance.";
const DESCRIPTION =
  "Talk to verified students and alumni before you choose a college. Real answers from real people, not brochures.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  // Explicit OG/Twitter tags rather than relying on title/description alone
  // — without these, link previews in WhatsApp/iMessage/Slack show no
  // thumbnail image at all, just plain text.
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://uniscope-uniscope2.vercel.app",
    siteName: "Uniscope",
    images: [
      {
        url: "https://kfxxsqxynofjywywygza.supabase.co/storage/v1/object/public/web-assets/hero-warm.jpg",
        width: 1600,
        height: 1067,
      },
    ],
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["https://kfxxsqxynofjywywygza.supabase.co/storage/v1/object/public/web-assets/hero-warm.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`h-full ${manrope.variable}`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
