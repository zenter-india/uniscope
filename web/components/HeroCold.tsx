import Image from "next/image";

/**
 * The "worried aspirant" hero. The approved design's headline, subtext, and
 * question bubbles are all baked into the photo itself — rendered as one
 * <Image> at its native aspect ratio (never cropped) rather than layering
 * separate HTML text on top, which would either duplicate the image's own
 * text or drift out of alignment with it. Full-bleed, no side/bottom margin
 * and no corner radius — the section's own bg-navy-deep matches the photo's
 * tone, so there's nothing for a margin to "contain" against; a gap here
 * just exposed flat navy on the sides and below instead of photo.
 */
export function HeroCold() {
  return (
    <section className="bg-navy-deep">
      {/* Real HTML, not baked into the photo — the photo can't be edited
          pixel-by-pixel, and this line is the kind of copy that's likely to
          be revised again, so it needs to stay editable text. */}
      <p className="max-w-xl mx-auto text-center px-6 pt-10 pb-5 text-[15px] md:text-[17px] font-semibold italic text-sky-300">
        &ldquo;The best people to help you choose a college are the people who are already studying there.&rdquo;
      </p>
      <Image
        src="https://kfxxsqxynofjywywygza.supabase.co/storage/v1/object/public/web-assets/hero-cold.jpg"
        alt="Too many questions before the right decision? You're not alone. A worried aspirant sits in an empty classroom surrounded by the questions on their mind: is there any toxicity, how's the curriculum, how's the climate, how's the placement support, how's the hands-on experience, how's life outside college, will I fit in there."
        width={1600}
        height={1326}
        className="w-full h-auto block"
        priority
        sizes="100vw"
      />
    </section>
  );
}
