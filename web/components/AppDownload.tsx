import { Reveal } from "./Reveal";
import { Stores } from "./Stores";

/** "Or get the Uniscope app" with the store buttons. Sits directly under the
 * Join Uniscope form (it used to be in the closing call-to-action above it).
 * Its background continues the colour the form section fades to, so the two
 * read as one block. */
export function AppDownload() {
  return (
    <section className="px-6 pt-4 pb-20 text-center bg-[#eceef3]">
      <Reveal>
        <p className="mb-4 text-[12.5px] font-extrabold uppercase tracking-[0.18em] text-gold-600">
          Or get the Uniscope app
        </p>
        <Stores leftFrom="never" tone="light" />
      </Reveal>
    </section>
  );
}
