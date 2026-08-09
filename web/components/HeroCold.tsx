import Image from "next/image";

/**
 * The "worried aspirant" hero. The approved design's headline, subtext, and
 * question bubbles are all baked into the photo itself — rendered as one
 * <Image> at its native aspect ratio (never cropped) rather than layering
 * separate HTML text on top, which would either duplicate the image's own
 * text or drift out of alignment with it. The background strip behind the
 * image matches its own tone so any letterboxing on unusual viewport ratios
 * blends in instead of showing raw page background.
 */
export function HeroCold() {
  return (
    <section className="bg-navy-deep">
      <Image
        src="/hero/hero-cold.png"
        alt="Too many questions before the right decision? You're not alone. A worried aspirant sits in an empty classroom surrounded by the questions on their mind: is there any toxicity, how's the curriculum, how's the climate, how's the placement support, how's the hands-on experience, how's life outside college, will I fit in there."
        width={3940}
        height={2627}
        className="w-full h-auto"
        priority
        sizes="100vw"
      />
    </section>
  );
}
