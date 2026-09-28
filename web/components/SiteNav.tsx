"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { RoleTrigger } from "./RoleTrigger";

const LINKS = [
  { href: "/explore", label: "Explore" },
  { href: "/mentors", label: "Mentors" },
  { href: "/colleges", label: "Colleges" },
  { href: "/download", label: "Get the app" },
];

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <nav
      className={`sticky top-0 z-40 bg-white/92 backdrop-blur-md border-b transition-shadow duration-300 ${
        scrolled || open ? "border-border shadow-[0_4px_20px_-8px_rgba(16,27,59,.15)]" : "border-transparent"
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

        <div className="hidden lg:flex gap-7 text-[14.5px] font-semibold text-slate-600">
          {LINKS.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`whitespace-nowrap border-b-2 py-1 transition-colors ${
                  active
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent hover:text-ink"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </div>

        <div className="flex gap-2.5 items-center">
          <RoleTrigger className="hidden sm:inline-flex items-center rounded-[9px] border-[1.5px] border-blue-600 text-blue-600 text-[13.5px] font-bold px-3.5 py-2 hover:bg-[#eef3ff] active:scale-[0.96] transition-all">
            Log in
          </RoleTrigger>
          <RoleTrigger className="inline-flex items-center rounded-[9px] bg-blue-600 text-white text-[13.5px] font-bold px-3.5 py-2 shadow-[0_8px_20px_-8px_rgba(33,72,201,0.55)] hover:bg-blue-500 active:scale-[0.96] transition-all">
            Sign up
          </RoleTrigger>
          <button
            type="button"
            className="lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-[9px] text-ink hover:bg-[#eef3ff] transition-colors"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
          </button>
        </div>
      </div>

      {open && (
        <div id="mobile-menu" className="lg:hidden border-t border-border bg-white">
          <div className="max-w-[1180px] mx-auto px-6 py-3 flex flex-col">
            {LINKS.map((l) => {
              const active = pathname === l.href;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className={`rounded-lg px-3 py-3 text-[16px] font-bold transition-colors ${
                    active ? "bg-[#eef3ff] text-blue-600" : "text-ink hover:bg-[#f4f5f7]"
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
            <div className="sm:hidden px-3 pt-2 pb-1" onClick={() => setOpen(false)}>
              <RoleTrigger className="inline-flex w-full items-center justify-center rounded-[9px] border-[1.5px] border-blue-600 text-blue-600 text-[14px] font-bold px-3.5 py-2.5 hover:bg-[#eef3ff] transition-all">
                Log in
              </RoleTrigger>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
