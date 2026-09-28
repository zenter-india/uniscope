import { Reveal } from "./Reveal";

const STEPS = [
  {
    n: "1",
    title: "Download & sign in",
    body: "Verify your phone number with a one-time code. No passwords to remember.",
  },
  {
    n: "2",
    title: "Find your mentors",
    body: "Browse by college, stream and degree — including the exact college you're considering.",
  },
  {
    n: "3",
    title: "Ask anything",
    body: "Start a chat, or book a live audio call in 6, 10 or 20-minute slots when you want a proper conversation.",
  },
];

export function HowItWorks() {
  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-[1000px]">
        <Reveal className="mx-auto max-w-[560px] text-center">
          <p className="text-[12.5px] font-extrabold uppercase tracking-wide text-blue-600">How it works</p>
          <h2 className="mt-2 text-[clamp(26px,3.6vw,36px)] font-extrabold leading-tight text-ink text-balance">
            From download to real answers in three steps
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 100}>
              <div className="h-full rounded-[22px] border border-border bg-surface p-7 shadow-[0_16px_36px_-24px_rgba(16,27,59,.25)]">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-linear-to-br from-gold-400 to-gold-600 text-[18px] font-extrabold text-white shadow-[0_10px_22px_-8px_rgba(180,132,42,.7)]">
                  {s.n}
                </span>
                <h3 className="mt-5 text-[18px] font-extrabold text-ink">{s.title}</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-slate-600">{s.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
