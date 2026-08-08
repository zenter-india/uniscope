const CARDS = [
  { name: "Mentor · 2nd yr", quote: "The curriculum is industry-focused. Lots of practical exposure from 2nd year!", rating: "5.0", pos: "top-[-8%] left-[-16%]" },
  { name: "Mentor · Alum", quote: "The weather is pleasant most of the year. You'll love the campus environment!", rating: "4.8", pos: "top-[-8%] right-[-16%]" },
  { name: "Mentor · 4th yr", quote: "Toxicity is minimal. Seniors are supportive and there's a healthy peer culture.", rating: "4.9", pos: "top-[36%] left-[-24%]" },
  { name: "Mentor · Alum", quote: "Hands-on learning is excellent — labs, workshops and live projects every semester.", rating: "5.0", pos: "top-[36%] right-[-24%]" },
  { name: "Mentor · 3rd yr", quote: "Placements are good. Many get placed through internships and company visits.", rating: "5.0", pos: "bottom-[-6%] left-[-12%]" },
  { name: "Mentor · Alum", quote: "Life outside college is vibrant — cafés, clubs, events and lots to explore.", rating: "4.9", pos: "bottom-[-6%] right-[-12%]" },
];

const FEATURES = [
  { icon: "💬", title: "Real Conversations", body: "Talk to students & alumni anonymously." },
  { icon: "🛡️", title: "Verified & Safe", body: "Every mentor is verified for your safety." },
  { icon: "❓", title: "Ask Anything", body: "Get answers to the questions that matter to you." },
  { icon: "🧭", title: "Make Confident Choices", body: "Choose the right college for your future." },
];

/** The "smiling mentor" hero + the four-feature strip beneath it. Same
 * swap-point pattern as HeroCold: `data-hero-photo` is the one element to
 * replace with the real photograph. */
export function HeroWarm() {
  return (
    <section className="relative overflow-hidden px-6 pt-21 pb-18 text-white bg-[linear-gradient(180deg,#2a1f10_0%,#3a2a14_55%,#241a0c_100%)]">
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(760px 460px at 50% -10%, rgba(221,176,90,.28), transparent 60%)" }}
      />
      <div className="relative max-w-[1180px] mx-auto">
        <div className="text-center max-w-[640px] mx-auto mb-15">
          <h2 className="text-[clamp(28px,4vw,40px)] font-extrabold leading-tight">
            Get real answers <span className="text-gold-400">from real people.</span>
          </h2>
          <p className="mt-3.5 text-[16.5px] font-semibold text-white/70">
            Connect with verified students &amp; alumni. Make confident choices.
          </p>
        </div>

        <div className="relative max-w-[780px] mx-auto">
          {CARDS.map((c) => (
            <div
              key={c.name + c.rating}
              className={`hidden md:block absolute z-[3] w-52 bg-[rgba(58,42,20,.88)] backdrop-blur-sm border border-gold-400/40 rounded-2xl px-3.5 py-3 shadow-[0_18px_40px_-18px_rgba(0,0,0,.6)] ${c.pos}`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-6.5 h-6.5 rounded-full bg-gradient-to-br from-gold-400 to-gold-600 shrink-0" />
                <span className="text-[12px] font-extrabold">{c.name}</span>
              </div>
              <p className="text-[12px] font-semibold text-white/78 leading-snug">{c.quote}</p>
              <div className="mt-1.5 text-[11.5px] font-extrabold text-gold-400">★★★★★ {c.rating}</div>
            </div>
          ))}

          <div
            data-hero-photo
            className="relative z-[2] mx-auto w-75 aspect-[3/3.5] rounded-[26px] border border-white/10 shadow-[0_40px_80px_-30px_rgba(0,0,0,.55)] overflow-hidden flex items-end justify-center"
            style={{
              background:
                "radial-gradient(140px 100px at 50% 16%, rgba(255,220,150,.22), transparent 60%), linear-gradient(160deg, #5a4322, #2c2110 65%)",
            }}
          >
            <div className="w-[70%] h-[80%] rounded-t-[130px] bg-[linear-gradient(180deg,#c99648,#5a4322)] opacity-85" />
          </div>
        </div>
      </div>

      <div className="relative max-w-[1000px] mx-auto -mb-14 mt-16 bg-surface border border-border rounded-[22px] shadow-[0_30px_60px_-30px_rgba(16,27,59,.25)] p-7 grid grid-cols-2 md:grid-cols-4 gap-2 text-ink">
        {FEATURES.map((f) => (
          <div key={f.title} className="text-center px-2.5 py-3.5">
            <div className="w-11.5 h-11.5 mx-auto mb-3 rounded-[13px] bg-[#eef3ff] text-blue-600 flex items-center justify-center text-xl">
              {f.icon}
            </div>
            <h4 className="text-[14.5px] font-extrabold">{f.title}</h4>
            <p className="mt-1 text-[12.5px] font-semibold text-slate-600 leading-snug">{f.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
