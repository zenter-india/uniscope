import { RoleTrigger } from "./RoleTrigger";

/** No trust-stats bar here on purpose — see conversation: the app has no
 * real users yet, and shipping invented numbers ("50K+ Students") is the
 * kind of claim that's expensive to walk back later. Add a stats section
 * once there are genuine figures worth showing. */
export function ClosingCta() {
  return (
    <section className="px-6 pt-24 pb-16 text-center">
      <h2 className="text-[clamp(24px,3.4vw,34px)] font-extrabold leading-tight">
        Your future is too important to guess.
        <span className="block text-gold-600">Uniscope it.</span>
      </h2>
      <div className="mt-6.5 flex gap-3.5 justify-center flex-wrap">
        <RoleTrigger
          role="student"
          className="inline-flex items-center rounded-[11px] bg-blue-600 text-white font-bold text-[15px] px-6.5 py-3.5 shadow-[0_8px_20px_-8px_rgba(33,72,201,.55)] hover:bg-blue-500 transition-colors"
        >
          Explore Colleges
        </RoleTrigger>
        <RoleTrigger
          role="mentor"
          className="inline-flex items-center rounded-[11px] bg-white text-blue-600 border-[1.5px] border-blue-600 font-bold text-[15px] px-6.5 py-3.5 hover:bg-[#eef3ff] transition-colors"
        >
          Talk to Mentors
        </RoleTrigger>
      </div>
    </section>
  );
}
