import { Reveal } from "./Reveal";
import { Stores } from "./Stores";
import { DownloadQr } from "./DownloadQr";

export const NAVY_GLOW =
  "radial-gradient(60% 55% at 78% 30%, rgba(46,91,232,.42), transparent 70%), radial-gradient(45% 45% at 8% 95%, rgba(221,176,90,.16), transparent 70%)";

/** The closing "get the app" band — store buttons plus a scan-to-download QR
 * code on desktop. Shared so every page on the site ends by pointing at the
 * app. */
export function DownloadBand({
  title = "Your future is too important to guess.",
  accent = "Uniscope it.",
  body = "Get the app and hear from the people who’ve already been where you’re headed.",
}: {
  title?: string;
  accent?: string;
  body?: string;
}) {
  return (
    <section className="relative overflow-hidden bg-navy-deep px-6 py-20 text-white" style={{ backgroundImage: NAVY_GLOW }}>
      <div className="mx-auto grid max-w-[1000px] items-center gap-10 md:grid-cols-[1fr_auto]">
        <Reveal className="text-center md:text-left">
          <h2 className="text-[clamp(26px,3.8vw,40px)] font-extrabold leading-tight text-balance">
            {title}
            <span className="block text-gold-400">{accent}</span>
          </h2>
          <p className="mx-auto mt-4 max-w-[480px] text-[15.5px] leading-relaxed text-white/75 md:mx-0">{body}</p>
          <div className="mt-7">
            <Stores leftFrom="md" />
          </div>
        </Reveal>

        <Reveal delay={150} className="hidden md:block">
          <div className="flex gap-4">
            {(
              [
                { platform: "ios", label: "iPhone" },
                { platform: "android", label: "Android" },
              ] as const
            ).map(({ platform, label }) => (
              <div
                key={platform}
                className="rounded-[24px] bg-white p-4 text-center shadow-[0_30px_60px_-24px_rgba(0,0,0,.7)]"
              >
                <DownloadQr platform={platform} className="h-[132px] w-[132px]" />
                <p className="mt-3 text-[12.5px] font-extrabold text-ink">{label}</p>
                <p className="text-[11.5px] font-semibold text-slate-600">Scan to get the app</p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
