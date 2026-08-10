import Image from "next/image";
import { MessageCircle, ShieldCheck, CircleHelp, Compass } from "lucide-react";
import { Reveal } from "./Reveal";

const FEATURES = [
  { Icon: MessageCircle, title: "Real Conversations", body: "Talk to students & alumni anonymously." },
  { Icon: ShieldCheck, title: "Verified & Safe", body: "Every mentor is verified for your safety." },
  { Icon: CircleHelp, title: "Ask Anything", body: "Get answers to the questions that matter to you." },
  { Icon: Compass, title: "Make Confident Choices", body: "Choose the right college for your future." },
];

/** The "smiling mentor" hero (headline, subtext, and all six mentor quote
 * cards are baked into the photo — same rationale as HeroCold) plus the
 * four-feature strip beneath it. */
export function HeroWarm() {
  return (
    <section className="bg-[#2a1f10] pt-10">
      {/* Same contained treatment as HeroCold — see that component's comment. */}
      <div className="max-w-[1180px] mx-auto px-6">
        <Image
          src="https://kfxxsqxynofjywywygza.supabase.co/storage/v1/object/public/web-assets/hero-warm.jpg"
          alt="Get real answers from real people. Connect with verified students and alumni, make confident choices. A smiling mentor sits in a sunlit classroom surrounded by six mentor quote cards about curriculum, campus culture, placements, hands-on learning, and campus life, each with a five-star-range rating."
          width={1600}
          height={1067}
          className="w-full h-auto rounded-[20px]"
          sizes="(min-width: 1180px) 1180px, 100vw"
        />
      </div>

      <div className="relative max-w-[1000px] mx-auto mt-10 md:mt-12 px-4 py-7 md:p-7 bg-surface border border-border rounded-[22px] shadow-[0_20px_40px_-24px_rgba(16,27,59,.2)] grid grid-cols-2 md:grid-cols-4 gap-2 text-ink">
        {FEATURES.map((f, i) => (
          <Reveal key={f.title} delay={i * 90}>
            <div className="group text-center px-2.5 py-3.5 rounded-2xl motion-safe:transition-transform motion-safe:duration-200 hover:-translate-y-1">
              <div className="w-11.5 h-11.5 mx-auto mb-3 rounded-[13px] bg-[#eef3ff] text-blue-600 flex items-center justify-center motion-safe:transition-transform motion-safe:duration-200 group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white">
                <f.Icon size={22} strokeWidth={2.25} />
              </div>
              <h4 className="text-[14.5px] font-extrabold">{f.title}</h4>
              <p className="mt-1 text-[12.5px] font-semibold text-slate-600 leading-snug">{f.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
