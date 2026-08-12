"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { RoleTrigger } from "./RoleTrigger";

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`sticky top-0 z-40 bg-white/92 backdrop-blur-md border-b transition-shadow duration-300 ${
        scrolled ? "border-border shadow-[0_4px_20px_-8px_rgba(16,27,59,.15)]" : "border-transparent"
      }`}
    >
      <div className="max-w-[1180px] mx-auto px-6 py-3.5 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="https://kfxxsqxynofjywywygza.supabase.co/storage/v1/object/public/web-assets/uniscope-icon.png"
            alt=""
            width={34}
            height={34}
            className="rounded-[10px]"
          />
          <div className="leading-tight">
            <span className="block font-extrabold text-[19px] text-navy-deep">Uniscope</span>
            <span className="hidden sm:block text-[10px] font-bold text-slate-400 whitespace-nowrap">
              Real Insights. Real Mentors. Real Guidance.
            </span>
          </div>
        </Link>

        <div className="hidden md:flex gap-7 text-[14.5px] font-semibold text-slate-600">
          <RoleTrigger className="hover:text-ink transition-colors">Explore</RoleTrigger>
          <RoleTrigger className="hover:text-ink transition-colors">Mentors</RoleTrigger>
          <RoleTrigger className="hover:text-ink transition-colors">Colleges</RoleTrigger>
        </div>

        <div className="flex gap-2.5 items-center">
          <RoleTrigger className="inline-flex items-center rounded-[9px] border-[1.5px] border-blue-600 text-blue-600 text-[13.5px] font-bold px-3.5 py-2 hover:bg-[#eef3ff] active:scale-[0.96] transition-all">
            Log in
          </RoleTrigger>
          <RoleTrigger className="inline-flex items-center rounded-[9px] bg-blue-600 text-white text-[13.5px] font-bold px-3.5 py-2 shadow-[0_8px_20px_-8px_rgba(33,72,201,0.55)] hover:bg-blue-500 active:scale-[0.96] transition-all">
            Sign up
          </RoleTrigger>
        </div>
      </div>
    </nav>
  );
}
