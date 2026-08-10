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

export const metadata: Metadata = {
  title: "Uniscope — See it. Hear it. Live it.",
  description:
    "Talk to verified students and alumni before you choose a college. Real answers from real people, not brochures.",
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
