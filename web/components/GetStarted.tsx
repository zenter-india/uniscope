"use client";

import { useEffect, useState } from "react";
import { AspirantForm } from "./AspirantForm";
import { MentorForm } from "./MentorForm";

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
        <div className="text-center max-w-[560px] mx-auto mb-11">
          <div className="text-[12.5px] font-extrabold uppercase tracking-wide text-blue-600">
            Get started
          </div>
          <h2 className="mt-2 text-[clamp(24px,3.2vw,32px)] font-extrabold">Join Uniscope</h2>
          <p className="mt-2.5 text-[15px] font-semibold text-slate-600">
            Tell us a bit about yourself — no account needed yet. We&apos;ll reach out once you&apos;re matched.
          </p>
        </div>

        {role === null && (
          <div className="max-w-[760px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-4.5">
            <button
              onClick={() => setRole("student")}
              className="text-left bg-surface border-[1.5px] border-border rounded-[20px] p-7 hover:-translate-y-1 hover:shadow-[0_20px_40px_-22px_rgba(16,27,59,.25)] transition-all"
            >
              <div className="w-12 h-12 rounded-[14px] bg-[#eef3ff] text-blue-600 flex items-center justify-center text-[22px] mb-4">
                🎓
              </div>
              <h3 className="text-[18px] font-extrabold">I&apos;m a Student</h3>
              <p className="mt-1.5 text-[13.5px] font-semibold text-slate-600 leading-relaxed">
                Get matched with verified mentors who&apos;ve been exactly where you&apos;re headed.
              </p>
              <div className="mt-4.5 text-[13.5px] font-extrabold text-blue-600">
                Continue as a student →
              </div>
            </button>

            <button
              onClick={() => setRole("mentor")}
              className="text-left bg-surface border-[1.5px] border-border rounded-[20px] p-7 hover:-translate-y-1 hover:shadow-[0_20px_40px_-22px_rgba(16,27,59,.25)] transition-all"
            >
              <div className="w-12 h-12 rounded-[14px] bg-[#fbf1de] text-gold-600 flex items-center justify-center text-[22px] mb-4">
                🧑‍🏫
              </div>
              <h3 className="text-[18px] font-extrabold">I&apos;m a Mentor</h3>
              <p className="mt-1.5 text-[13.5px] font-semibold text-slate-600 leading-relaxed">
                Current student or alum? Guide aspirants and get paid for your time.
              </p>
              <div className="mt-4.5 text-[13.5px] font-extrabold text-gold-600">
                Continue as a mentor →
              </div>
            </button>
          </div>
        )}

        {role === "student" && <AspirantForm onExit={() => setRole(null)} />}
        {role === "mentor" && <MentorForm onExit={() => setRole(null)} />}
      </div>
    </section>
  );
}
