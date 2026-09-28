import type { Metadata } from "next";
import { SiteNav } from "../../components/SiteNav";
import { SiteFooter } from "../../components/SiteFooter";
import { PageHero } from "../../components/PageHero";
import { CollegesExplorer } from "../../components/CollegesExplorer";
import { DownloadBand } from "../../components/DownloadBand";

export const metadata: Metadata = {
  title: "Explore colleges — Uniscope",
  description:
    "Search colleges across India by name, stream and level — then talk to the students and alumni who are actually there, on the Uniscope app.",
};

export default function CollegesPage() {
  return (
    <>
      <SiteNav />
      <main>
        <PageHero
          eyebrow="Colleges"
          title="Find your college."
          accent="Then ask the people who go there."
          intro="Search colleges across India by name, stream and level. When you’ve found the ones you’re considering, hear what they’re really like from students and alumni in the Uniscope app."
        />
        <CollegesExplorer />
        <DownloadBand
          title="Found a college you like?"
          accent="Ask someone who’s there."
          body="Get the app to chat with students and alumni from the colleges on your list — before you decide."
        />
      </main>
      <SiteFooter />
    </>
  );
}
