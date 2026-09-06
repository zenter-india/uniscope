import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "../../components/SiteNav";

export const metadata: Metadata = {
  title: "Community Guidelines — Uniscope",
  description: "The standards expected from all Aspirants, Mentors, and other Users of the Uniscope platform.",
};

const EFFECTIVE_DATE = "01/08/2026";
const LAST_UPDATED = "08/08/2026";
const CONTACT_EMAIL = "support@uniscope.in";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10 first:mt-0">
      <h2 className="text-[19px] font-extrabold text-ink">{title}</h2>
      <div className="mt-3 space-y-3 text-[14.5px] leading-relaxed text-slate-600">{children}</div>
    </section>
  );
}

export default function CommunityGuidelinesPage() {
  return (
    <>
      <SiteNav />
      <main className="px-6 py-14">
        <div className="max-w-[720px] mx-auto">
          <p className="text-[12.5px] font-extrabold uppercase tracking-wide text-blue-600">Legal</p>
          <h1 className="mt-2 text-[clamp(26px,4vw,36px)] font-extrabold text-ink text-wrap-balance">
            Community Guidelines
          </h1>
          <p className="mt-2 text-[13.5px] font-semibold text-slate-400">
            Effective date: {EFFECTIVE_DATE} · Last updated: {LAST_UPDATED}
          </p>

          <Section title="Acceptance & Legal Framework">
            <p>{`Welcome to Uniscope. By accessing, registering on, or using Uniscope ("Platform", "Website", "Company", "we", "our", or "us"), you ("User", "Member", or "you") agree to be bound by these Terms and Conditions. This Platform operates as an "intermediary" as defined under Section 2(1)(w) of the Information Technology Act, 2000 and complies with the Digital Personal Data Protection Act, 2023.`}</p>
            <p>{`UNISCOPE is a technology platform owned and operated by AMSEL GOLD (bearing GSTIN: 33CRHPP4257Q1Z3), a sole proprietorship concern of Pon Buvaneshwaran, incorporated and validly existing under the laws of India, and it's Subsidiary operating under the trade name "UNISCOPE", having its registered office at NO 8, SELVA NAGAR, EETTI THERU, METTUPPATTI, PUDUKKOTTAI, TAMIL NADU, INDIA-622303.`}</p>
          </Section>

          <Section title="1. Purpose and Scope">
            <p>
              These Community Guidelines (&ldquo;Guidelines&rdquo;) set out the standards expected from all Users of
              Uniscope, including Aspirants, Mentors, and other persons using the Platform.
            </p>
            <p>
              Uniscope is intended to provide a safe, respectful, and useful environment where Aspirants can
              discover Institutions and connect with verified Mentors for experience-based guidance. These
              Guidelines form part of the Uniscope Terms and Conditions and should be read together with the
              Privacy Policy and Refund and Cancellation Policy.
            </p>
          </Section>

          <Section title="2. Our Community Standards">
            <p>Users are expected to:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Treat other Users with respect, honesty, and professionalism.</li>
              <li>Communicate respectfully and appropriately.</li>
              <li>Provide truthful and accurate information about themselves and their educational background.</li>
              <li>Respect the privacy, identity, boundaries, and personal information of other Users.</li>
              <li>Use the Platform for its intended educational discovery and mentorship purposes.</li>
              <li>Follow the Terms, Privacy Policy, Refund and Cancellation Policy, and other Platform rules.</li>
              <li>Report unsafe, abusive, fraudulent, or prohibited behaviour.</li>
            </ul>
          </Section>

          <Section title="3. Mentor Conduct">
            <p>
              Mentors are verified current students or graduates who share experience-based guidance. Verification
              confirms an Institution association and does not certify a Mentor&rsquo;s character, competence,
              academic performance, or future conduct.
            </p>
            <p>Mentors must:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Provide information honestly and distinguish personal experience from official Institution information.</li>
              <li>Avoid false, misleading, or exaggerated claims about their Institution, course, qualifications, or outcomes.</li>
              <li>Not guarantee admission, scholarships, placements, examination results, internships, visas, licensing, employment, or other outcomes.</li>
              <li>Not claim to be an Institution employee, admissions officer, placement officer, representative, or spokesperson unless authorised.</li>
              <li>Not facilitate cheating, examination impersonation, forged documents, admission fraud, bribery, or unlawful activity.</li>
              <li>Respect Aspirants&rsquo; questions, boundaries, privacy, and right to end or reschedule a Session.</li>
              <li>Use Uniscope&rsquo;s payment and Session systems and not bypass applicable fees or safeguards.</li>
            </ul>
          </Section>

          <Section title="4. Aspirant Conduct">
            <p>Aspirants must:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Provide accurate information during registration and use of the Platform.</li>
              <li>Communicate respectfully with Mentors and other Users.</li>
              <li>Use Sessions for genuine educational and career-related guidance.</li>
              <li>Not pressure Mentors for guarantees, confidential Institution information, personal contact details, or off-platform services.</li>
              <li>Attend confirmed Sessions or use the Platform&rsquo;s cancellation or rescheduling process where available.</li>
              <li>Not misuse reporting, refund, cancellation, or rescheduling systems.</li>
              <li>Not request or encourage cheating, document fraud, admission fraud, or other unlawful conduct.</li>
            </ul>
          </Section>

          <Section title="5. In-App Chat and Calling">
            <p>
              Uniscope&rsquo;s built-in chat and calling features are designed to allow Users to communicate without
              requiring personal telephone numbers or direct contact details.
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Do not pressure another User to move communication outside Uniscope.</li>
              <li>Do not request or disclose passwords, OTPs, financial credentials, unnecessary identity documents, or sensitive personal information.</li>
              <li>Do not use chat or calls for harassment, threats, stalking, sexual misconduct, fraud, spam, scams, or unlawful activity.</li>
              <li>Do not attempt to bypass payment, verification, safety, moderation, or security systems.</li>
              <li>Do not pressure another User to reveal their legal identity or private contact information.</li>
            </ul>
          </Section>

          <Section title="6. Screenshots, Screen Recording and Recording">
            <p>Users must respect the privacy of communications conducted through Uniscope.</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                Do not screenshot, screen-record, photograph, copy, reproduce, publish, or distribute private
                conversations, calls, or personal information obtained through the Platform without the relevant
                person&rsquo;s consent, except where required or expressly permitted by Applicable Law.
              </li>
              <li>
                Accepting or participating in a Uniscope call does not, by itself, constitute consent to recording,
                screen recording, photography, screenshotting, or other capture of the call or content displayed
                during it.
              </li>
              <li>Do not use captured content to harass, threaten, embarrass, impersonate, defame, or otherwise harm another User.</li>
            </ul>
          </Section>

          <Section title="7. Privacy and Personal Boundaries">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Do not attempt to identify, trace, expose, publish, or circulate a Mentor&rsquo;s real identity where the Mentor uses an alias.</li>
              <li>Do not publish or share another User&rsquo;s phone number, email address, address, identity documents, or other private information without consent or lawful authority.</li>
              <li>Do not pressure another User to disclose information they do not wish to share.</li>
              <li>Do not use information obtained through Uniscope for stalking, harassment, unsolicited contact, or unrelated purposes.</li>
            </ul>
          </Section>

          <Section title="8. Ratings, Reviews and Feedback">
            <p>
              Ratings and reviews provide prospective students with additional insight into Institutions and
              reflect the individual experiences and opinions of the respective Users.
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Share genuine experiences or information reasonably believed to be accurate.</li>
              <li>Do not knowingly publish false, fabricated, deceptive, or malicious allegations.</li>
              <li>Do not publish another person&rsquo;s private or confidential information.</li>
              <li>Do not manipulate ratings through multiple accounts, fake reviews, incentives for dishonest reviews, or other methods.</li>
            </ul>
            <p>Ratings and reviews are not endorsements, rankings, or guarantees by Uniscope.</p>
          </Section>

          <Section title="9. Prohibited Conduct and Content">
            <p>Users must not engage in or facilitate:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Harassment, bullying, threats, intimidation, stalking, or persistent unwanted contact.</li>
              <li>Sexual harassment, sexual exploitation, or inappropriate sexual conduct.</li>
              <li>Exploitation, grooming, or inappropriate contact involving Minors.</li>
              <li>Unlawful discrimination, hate-based abuse, or targeted harassment.</li>
              <li>Fraud, impersonation, identity deception, or forged or fraudulent documents.</li>
              <li>Academic cheating, examination impersonation, admission fraud, bribery, or unlawful admission practices.</li>
              <li>Doxxing or unauthorised disclosure of another person&rsquo;s private information.</li>
              <li>Knowingly false, deceptive, or maliciously misleading content intended to cause harm.</li>
              <li>Spam, phishing, scams, malware, or other harmful activity.</li>
              <li>Unauthorised commercial solicitation or promotion.</li>
              <li>Infringement of intellectual-property, privacy, confidentiality, or other rights.</li>
              <li>Attempts to bypass or manipulate payment, verification, moderation, safety, security, or account restrictions.</li>
            </ul>
          </Section>

          <Section title="10. Payments and Off-Platform Transactions">
            <p>Where paid Mentor Sessions are offered, Users must use the payment and booking mechanisms provided by Uniscope.</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Do not arrange private payment for a Session through Uniscope where intended to avoid Platform fees, safeguards, or policies.</li>
              <li>Do not share payment credentials or OTPs with another User.</li>
              <li>Do not manipulate bookings, cancellations, refunds, UniMinutes, payouts, or payment records.</li>
              <li>Do not create multiple accounts or manipulate the Platform to obtain unauthorised benefits.</li>
            </ul>
          </Section>

          <Section title="11. Session Attendance, Cancellation and Rescheduling">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>A Mentor or Aspirant may request to reschedule a confirmed call through the Platform at anytime before the scheduled call time, subject to availability of both parties and available Platform time slots.</li>
              <li>Where both parties agree to a new available time through the Platform, the Session may be rescheduled without new payment or additional UniMinutes, subject to Platform rules.</li>
              <li>Repeated no-shows, cancellations, or misuse of rescheduling may result in restrictions.</li>
            </ul>
            <p>
              Refunds, UniMinutes treatment, Mentor no-shows, technical issues, and payment consequences are
              governed by the Refund and Cancellation Policy.
            </p>
          </Section>

          <Section title="12. Mentor Verification and Identity">
            <p>Mentors must provide genuine and accurate information and documents for verification.</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Do not submit forged, altered, expired, fabricated, or misleading verification documents.</li>
              <li>Do not impersonate another student, graduate, Institution, or representative.</li>
              <li>Do not falsely claim an Institution association.</li>
              <li>Do not expose or circulate another Mentor&rsquo;s verified identity or verification documents.</li>
            </ul>
            <p>
              Uniscope may suspend, restrict, revoke verification, or terminate accounts where verification
              information is false, misleading, fraudulent, outdated, or unverifiable.
            </p>
          </Section>

          <Section title="13. Safety and Reporting">
            <p>Users should report conduct that may threaten community safety, privacy, or integrity.</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Harassment, threats, stalking, or unsafe behaviour.</li>
              <li>Fraudulent Mentor verification or impersonation.</li>
              <li>Privacy violations, unauthorised recording, or sharing private information.</li>
              <li>Fraud, scams, payment manipulation, or Platform abuse.</li>
              <li>Illegal or prohibited content.</li>
              <li>Academic cheating, admission fraud, or forged documents.</li>
              <li>Serious violations of these Guidelines or the Terms.</li>
            </ul>
            <p>
              Reports should be submitted through Platform reporting tools or published support channels, with
              sufficient information and evidence where reasonably available.
            </p>
          </Section>

          <Section title="14. Moderation and Enforcement">
            <p>
              Uniscope may review reports and take action where reasonably necessary to protect Users, maintain
              Platform integrity, enforce these Guidelines, or comply with Applicable Law.
            </p>
            <p>Depending on the circumstances, Uniscope may:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Remove, restrict, or reduce the visibility of content.</li>
              <li>Restrict communication or Platform features.</li>
              <li>Pause, cancel, or restrict Sessions.</li>
              <li>Suspend or terminate accounts.</li>
              <li>Suspend, restrict, or revoke Mentor verification.</li>
              <li>Withhold or adjust Mentor payouts where permitted by applicable policies and law.</li>
              <li>Restrict bookings, payments, or other Platform features.</li>
              <li>Preserve or disclose relevant information where required or permitted by Applicable Law.</li>
            </ul>
            <p>
              Enforcement may consider seriousness, evidence, User history, repeated violations, safety risks,
              impact on others, and legal requirements.
            </p>
          </Section>

          <Section title="15. False or Malicious Reports">
            <p>
              Users must not knowingly submit false reports, fabricate evidence, or misuse reporting mechanisms to
              harass, retaliate against, defame, or unfairly restrict another User.
            </p>
            <p>Good-faith reports will not be penalised merely because an investigation does not establish a violation.</p>
          </Section>

          <Section title="16. Educational Integrity">
            <p>Uniscope is intended for experience-based guidance and educational discovery.</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Do not request or provide assistance intended to facilitate cheating or examination impersonation.</li>
              <li>Do not create, obtain, sell, or submit forged educational or admission documents.</li>
              <li>Do not offer or request payment for unlawful admission arrangements, bribery, or preferential treatment.</li>
              <li>Do not misrepresent academic qualifications, Institution affiliation, examination results, or professional credentials.</li>
            </ul>
          </Section>

          <Section title="17. User Content">
            <p>
              Users retain ownership of their User Content and must ensure that submitted content is lawful and
              does not knowingly infringe another person&rsquo;s privacy, confidentiality, intellectual-property, or
              other rights.
            </p>
            <p>
              Uniscope may moderate, restrict, or remove User Content where reasonably necessary to enforce
              Platform policies, protect Users, address safety concerns, comply with Applicable Law, or maintain
              Platform integrity.
            </p>
          </Section>

          <Section title="18. No Guarantee of Outcomes">
            <p>
              Mentor guidance reflects personal experience and should not be treated as an official statement of an
              Institution or a guarantee by Uniscope.
            </p>
            <p>
              Users must not represent that a Session guarantees admission, scholarships, placements, examination
              results, internships, visas, licensing, employment, or any other outcome.
            </p>
          </Section>

          <Section title="19. Platform Integrity">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Do not create multiple accounts to evade restrictions or manipulate ratings, bookings, refunds, or Platform benefits.</li>
              <li>Do not attempt to access another User&rsquo;s account.</li>
              <li>Do not exploit vulnerabilities or interfere with Platform security.</li>
              <li>Do not scrape, copy, or abuse Platform data without authorisation.</li>
              <li>Do not intentionally disrupt Sessions, communications, payments, verification, or other Platform functions.</li>
            </ul>
          </Section>

          <Section title="20. Consequences of Violations">
            <p>
              Violations may result in warnings, content removal, feature restrictions, Session cancellation,
              suspension, loss of verification, payout adjustment, account termination, or other appropriate action,
              subject to Applicable Law.
            </p>
            <p>
              Serious or unlawful conduct may be reported to the relevant Institution, competent authority,
              law-enforcement agency, or other appropriate body where required or legally permitted.
            </p>
          </Section>

          <Section title="21. Relationship with Other Policies">
            <p>
              These Guidelines form part of the Uniscope Terms and Conditions and should be read with the Privacy
              Policy and Refund and Cancellation Policy. Service-specific rules concerning refunds, cancellations,
              UniMinutes, or Session payments are governed by the Refund and Cancellation Policy.
            </p>
          </Section>

          <Section title="22. Updates">
            <p>
              Uniscope may update these Guidelines to reflect changes in Platform features, community risks,
              business practices, or Applicable Law. The updated version will state its effective or last-updated
              date.
            </p>
          </Section>

          <Section title="23. Contact and Reporting">
            <p>Grievance Officer: Mr. PON BUVANESHWARAN</p>
            <p>
              Email:{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-600 font-bold hover:underline">
                {CONTACT_EMAIL}
              </a>
            </p>
            <p>
              Phone:{" "}
              <a href="tel:+917010441518" className="text-blue-600 font-bold hover:underline">
                +91 70104 41518
              </a>
            </p>
            <p>Address: No. 8, Selva Nagar, Eetti Theru, Mettuppatti, Pudukkottai, Tamil Nadu, India – 622303</p>
            <p>Legal Entity: AMSEL GOLD, operating under the trade name &ldquo;UNISCOPE&rdquo;</p>
            <p>
              Website:{" "}
              <a href="https://www.uniscope.in/" className="text-blue-600 font-bold hover:underline">
                https://www.uniscope.in/
              </a>
            </p>
          </Section>

          <Section title="24. Governing Law">
            <p>
              These Guidelines are governed by the laws of India and should be read together with the Uniscope
              Terms and Conditions. Subject to mandatory consumer and statutory jurisdiction, disputes shall be
              subject to the courts or tribunals having jurisdiction over Pudukkottai, Tamil Nadu, India.
            </p>
          </Section>

          <Section title="25. Community Promise">
            <p>
              Uniscope exists to make choosing an educational path less uncertain. Every Mentor who shares an
              honest experience can help someone make a better decision. Every Aspirant who asks a thoughtful
              question contributes to a stronger community.
            </p>
            <p className="font-bold text-ink">
              Be honest. Be respectful. Protect privacy. Help each other. And remember: behind every profile is a
              real person.
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
