import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "../../components/SiteNav";

export const metadata: Metadata = {
  title: "Privacy Policy — Uniscope",
  description: "How Uniscope collects, stores, and uses the information you share when you enrol as a student or mentor.",
};

const LAST_UPDATED = "12 August 2026";
const CONTACT_EMAIL = "support@uniscope.in";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10 first:mt-0">
      <h2 className="text-[19px] font-extrabold text-ink">{title}</h2>
      <div className="mt-3 space-y-3 text-[14.5px] leading-relaxed text-slate-600">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <>
      <SiteNav />
      <main className="px-6 py-14">
        <div className="max-w-[720px] mx-auto">
          <p className="text-[12.5px] font-extrabold uppercase tracking-wide text-blue-600">Legal</p>
          <h1 className="mt-2 text-[clamp(26px,4vw,36px)] font-extrabold text-ink text-wrap-balance">
            Privacy Policy
          </h1>
          <p className="mt-2 text-[13.5px] font-semibold text-slate-400">Last updated: {LAST_UPDATED}</p>

          <p className="mt-6 text-[14.5px] leading-relaxed text-slate-600">
            This page explains what happens to the information you share when you fill out the &ldquo;I&apos;m a
            Student&rdquo; or &ldquo;I&apos;m a Mentor&rdquo; form on this site, before you have a Uniscope
            account. It doesn&apos;t cover the Uniscope mobile app itself, which has its own privacy terms shown
            during sign-up.
          </p>

          <Section title="What we collect">
            <p>When you fill out the enrolment form, we collect what you type into it:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Your full name and phone number (required)</li>
              <li>Email, date of birth, gender, state, and city, if you provide them</li>
              <li>
                If you&apos;re signing up as a student: your qualification, field of interest, the course you&apos;re
                aiming for, and your language/mentorship-timing preferences
              </li>
              <li>
                If you&apos;re signing up as a mentor: your college, stream, degree, current status, languages, and
                availability — plus, if you choose to upload one, a photo of your college ID for verification
              </li>
            </ul>
            <p>
              We don&apos;t use cookies, analytics scripts, or any third-party tracking on this site — nothing is
              collected beyond what you type into the form.
            </p>
          </Section>

          <Section title="Why we collect it, and why your phone number stays as plain text">
            <p>
              This form exists so we can reach you once your account is ready — that&apos;s it. Every other field
              helps us match students with the right mentors sooner.
            </p>
            <p>
              Almost everything else in Uniscope&apos;s systems stores phone numbers in a scrambled, one-way form
              that can&apos;t be reversed back into a real number. Here, we deliberately don&apos;t — a lead we
              can&apos;t actually call or text back would be useless to both you and us, so your phone number is
              kept in plain, readable form specifically so our team can contact you.
            </p>
          </Section>

          <Section title="Where it's stored">
            <p>
              Your answers are stored in our database as a standalone record, kept separate from Uniscope&apos;s
              regular user accounts — because at this stage, you don&apos;t have one yet. If a mentor ID photo is
              uploaded, the image itself is stored in a private file bucket that isn&apos;t publicly accessible;
              only our team can view it, and only through a temporary, expiring link generated on request.
            </p>
            <p>Access to any of this data is restricted to Uniscope&apos;s own admin team — it is never public.</p>
          </Section>

          <Section title="Who sees it">
            <p>
              Nobody outside Uniscope. We don&apos;t sell, rent, or share your information with advertisers or
              other third parties. It&apos;s used only to follow up with you and, if you go on to create a real
              Uniscope account, to carry your details over so you don&apos;t have to re-enter them.
            </p>
          </Section>

          <Section title="How long we keep it">
            <p>
              We keep your submission until either you become a registered Uniscope user (at which point it&apos;s
              linked to your real account) or you ask us to delete it. If you fill out the form more than once with
              the same phone number, your later answers simply update the same record rather than creating a
              duplicate.
            </p>
          </Section>

          <Section title="Your choices">
            <p>
              You can ask us at any time to tell you what we have on file, correct it, or delete it entirely —
              email{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-600 font-bold hover:underline">
                {CONTACT_EMAIL}
              </a>{" "}
              from the same email or phone number you used on the form, and we&apos;ll act on it.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions about this policy or your data can be sent to{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-600 font-bold hover:underline">
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </Section>

          <div className="mt-12 pt-6 border-t border-border">
            <Link href="/" className="text-[13.5px] font-bold text-blue-600 hover:underline">
              ← Back to Uniscope
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
