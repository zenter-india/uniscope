"use client";

import { useEffect, useState } from "react";
import { AspirantForm } from "./AspirantForm";
import { MentorForm } from "./MentorForm";
import { Reveal } from "./Reveal";

type Role = "student" | "mentor" | null;

export function GetStarted() {
  const [role, setRole] = useState<Role>(null);

  // Every nav/hero/CTA trigger on the page dispatches this — see
  // RoleTrigger's comment for why an event instead of context.
  useEffect(() => {
    const handler = (e: Event) => setRole((e as CustomEvent<Role>).detail);
    window.addEventListener("uniscope:pick-role", handler);
    return () => window.removeEventListener("uniscope:pick-role", handler);
  }, []);

  return (
    <section id="get-started" className="px-6 pt-22 pb-27 bg-[linear-gradient(180deg,var(--page),#eceef3)]">
      <div className="max-w-[1180px] mx-auto">
        <Reveal className="text-center max-w-[560px] mx-auto mb-11">
          <div className="text-[12.5px] font-extrabold uppercase tracking-wide text-blue-600">
            Get started
          </div>
          <h2 className="mt-2 text-[clamp(24px,3.2vw,32px)] font-extrabold">Join Uniscope</h2>
          <p className="mt-2.5 text-[15px] font-semibold text-slate-600">
            Tell us a bit about yourself — no account needed yet. We&apos;ll reach out once you&apos;re matched.
          </p>
        </Reveal>

        {role === null && (
          <div className="max-w-[760px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-4.5">
            <Reveal delay={80}>
              <button
                onClick={() => setRole("student")}
                className="group w-full text-left bg-surface border-[1.5px] border-border rounded-[20px] p-7 hover:border-blue-600/40 hover:-translate-y-1.5 hover:shadow-[0_24px_48px_-24px_rgba(33,72,201,.35)] active:scale-[0.98] active:translate-y-0 transition-all duration-200"
              >
                <div className="w-12 h-12 rounded-[14px] bg-[#eef3ff] text-blue-600 flex items-center justify-center text-[22px] mb-4 transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-6">
                  🎓
                </div>
                <h3 className="text-[18px] font-extrabold">I&apos;m a Student</h3>
                <p className="mt-1.5 text-[13.5px] font-semibold text-slate-600 leading-relaxed">
                  Get matched with verified mentors who&apos;ve been exactly where you&apos;re headed.
                </p>
                <div className="mt-4.5 text-[13.5px] font-extrabold text-blue-600 flex items-center gap-1.5">
                  Continue as a student
                  <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
                </div>
              </button>
            </Reveal>

            <Reveal delay={160}>
              <button
                onClick={() => setRole("mentor")}
                className="group w-full text-left bg-surface border-[1.5px] border-border rounded-[20px] p-7 hover:border-gold-500/40 hover:-translate-y-1.5 hover:shadow-[0_24px_48px_-24px_rgba(201,150,47,.35)] active:scale-[0.98] active:translate-y-0 transition-all duration-200"
              >
                <div className="w-12 h-12 rounded-[14px] bg-[#fbf1de] text-gold-600 flex items-center justify-center text-[22px] mb-4 transition-transform duration-200 group-hover:scale-110 group-hover:rotate-6">
                  🧑‍🏫
                </div>
                <h3 className="text-[18px] font-extrabold">I&apos;m a Mentor</h3>
                <p className="mt-1.5 text-[13.5px] font-semibold text-slate-600 leading-relaxed">
                  Current student or alum? Guide aspirants and get paid for your time.
                </p>
                <div className="mt-4.5 text-[13.5px] font-extrabold text-gold-600 flex items-center gap-1.5">
                  Continue as a mentor
                  <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
                </div>
              </button>
            </Reveal>
          </div>
        )}

        {role === "student" && <AspirantForm onExit={() => setRole(null)} />}
        {role === "mentor" && <MentorForm onExit={() => setRole(null)} />}
      </div>
    </section>
  );
}
