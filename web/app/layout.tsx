import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Manrope is bundled with the site (app/fonts, the same files the mobile app
// uses) instead of being fetched from Google Fonts at build time: that fetch
// started failing the build ("next/font/google queries have exactly one
// entry"). See globals.css for why Manrope: it's the mobile app's brand face.
// Weights match what the page actually uses.
const manrope = localFont({
  src: [
    { path: "./fonts/Manrope-Regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/Manrope-Medium.ttf", weight: "500", style: "normal" },
    { path: "./fonts/Manrope-SemiBold.ttf", weight: "600", style: "normal" },
    { path: "./fonts/Manrope-Bold.ttf", weight: "700", style: "normal" },
    { path: "./fonts/Manrope-ExtraBold.ttf", weight: "800", style: "normal" },
  ],
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
    url: "https://uniscope.in",
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
