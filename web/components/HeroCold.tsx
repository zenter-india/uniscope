const BUBBLES = [
  { text: "Is there any toxicity?", pos: "top-0 left-[-2%]" },
  { text: "How's the curriculum?", pos: "top-[-20px] left-[32%]" },
  { text: "How's the climate over there?", pos: "top-0 right-[-4%]" },
  { text: "How's the placement support?", pos: "top-[40%] left-[-10%]" },
  { text: "How's the hands-on experience?", pos: "top-[38%] right-[-12%]" },
  { text: "How's life outside the college?", pos: "bottom-[4%] left-0" },
  { text: "Will I fit in there?", pos: "bottom-[2%] right-[-2%]" },
];

/**
 * The "worried aspirant" hero. The photo is not in yet (see conversation) —
 * `<div data-hero-photo>` is the one element to swap for a real <Image> once
 * it arrives; everything around it (bubbles, copy, layout) stays as-is.
 */
export function HeroCold() {
  return (
    <section className="relative overflow-hidden px-6 pt-19 pb-23 text-white bg-[linear-gradient(180deg,var(--navy-deep)_0%,var(--navy-800)_55%,#0a1a42_100%)]">
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(900px 500px at 18% -10%, rgba(46,91,232,.35), transparent 60%), radial-gradient(700px 460px at 85% 10%, rgba(127,178,242,.22), transparent 55%)",
        }}
      />
      <div className="relative max-w-[1180px] mx-auto">
        <div className="text-center max-w-[640px] mx-auto mb-14">
          <div className="inline-flex items-center gap-2 text-[12.5px] font-bold uppercase tracking-wide text-sky-300 mb-3.5 before:content-[''] before:w-1.5 before:h-1.5 before:rounded-full before:bg-sky-300">
            Before you decide
          </div>
          <h1 className="text-[clamp(30px,4.4vw,44px)] font-extrabold leading-tight">
            Too many questions <span className="text-sky-300">before the right decision?</span>
          </h1>
          <p className="mt-4 text-[17px] font-semibold text-white/72">You&apos;re not alone.</p>
        </div>

        <div className="relative max-w-[780px] mx-auto">
          {BUBBLES.map((b) => (
            <div
              key={b.text}
              className={`hidden md:block absolute z-[3] max-w-[178px] bg-[rgba(18,32,74,.85)] backdrop-blur-sm border border-sky-300/35 rounded-2xl px-3.5 py-3 text-[13px] font-bold text-[#eaf1ff] shadow-[0_18px_40px_-18px_rgba(0,0,0,.6)] ${b.pos}`}
            >
              {b.text}
              <span className="absolute -top-2 right-3.5 text-sky-300">?</span>
            </div>
          ))}

          <div
            data-hero-photo
            className="relative z-[2] mx-auto w-80 aspect-[3/3.6] rounded-[28px] border border-white/9 shadow-[0_40px_80px_-30px_rgba(0,0,0,.6)] overflow-hidden flex items-end justify-center"
            style={{
              background:
                "radial-gradient(120px 90px at 50% 18%, rgba(255,255,255,.14), transparent 60%), linear-gradient(160deg, #17255a, #0a1636 65%)",
            }}
          >
            <div className="w-[72%] h-[82%] rounded-t-[140px] bg-[linear-gradient(180deg,#24336e,#0c1638)] opacity-90" />
          </div>
        </div>
      </div>
    </section>
  );
}
