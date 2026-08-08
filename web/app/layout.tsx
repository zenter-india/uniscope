import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Uniscope — See it. Hear it. Live it.",
  description:
    "Talk to verified students and alumni before you choose a college. Real answers from real people, not brochures.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
