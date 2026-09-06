import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "../../components/SiteNav";

export const metadata: Metadata = {
  title: "Privacy Policy — Uniscope",
  description: "How Uniscope collects, uses, stores, processes, shares, and protects your personal information.",
};

const CONTACT_EMAIL = "support@uniscope.in";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10 first:mt-0">
      <h2 className="text-[19px] font-extrabold text-ink">{title}</h2>
      <div className="mt-3 space-y-3 text-[14.5px] leading-relaxed text-slate-600">{children}</div>
    </section>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5 first:mt-0">
      <h3 className="text-[15.5px] font-extrabold text-ink">{title}</h3>
      <div className="mt-2 space-y-2 text-[14.5px] leading-relaxed text-slate-600">{children}</div>
    </div>
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

          <p className="mt-6 text-[14.5px] leading-relaxed text-slate-600">
            This Privacy Policy (&ldquo;Policy&rdquo;) explains how Uniscope, operating the platform Uniscope
            (&ldquo;Platform&rdquo;, &ldquo;Website&rdquo;, &ldquo;Company&rdquo;, &ldquo;we&rdquo;,
            &ldquo;our&rdquo;, or &ldquo;us&rdquo;), collects, uses, stores, processes, shares, and protects your
            personal information when you access or use our Platform.
          </p>
          <p className="mt-3 text-[14.5px] leading-relaxed text-slate-600">
            This Policy should be read together with our Terms and Conditions.
          </p>
          <p className="mt-3 text-[14.5px] leading-relaxed text-slate-600">
            By accessing, registering, or using the Platform, you consent to the collection and processing of your
            personal data in accordance with this Privacy Policy and applicable laws of India, including the
            Digital Personal Data Protection Act, 2023 (DPDP Act), the Information Technology Act, 2000, and other
            applicable regulations.
          </p>

          <Section title="Who We Are">
            <p className="font-bold text-ink">UNISCOPE</p>
            <p>Owned and operated by: AMSEL GOLD (Sole Proprietorship)</p>
            <p>Proprietor: PON BUVANESHWARAN</p>
            <p>Registered office: No. 8, Selva Nagar, Eetti Theru, Mettuppatti, Pudukkottai, Tamil Nadu, India – 622303</p>
            <p>
              Email:{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-600 font-bold hover:underline">
                {CONTACT_EMAIL}
              </a>
            </p>
            <p>
              Website:{" "}
              <a href="https://www.uniscope.in/" className="text-blue-600 font-bold hover:underline">
                https://www.uniscope.in/
              </a>
            </p>
          </Section>

          <Section title="1. Introduction">
            <p>
              This Privacy Policy explains how Uniscope (&ldquo;Uniscope&rdquo;, &ldquo;we&rdquo;, &ldquo;our&rdquo;,
              or &ldquo;us&rdquo;) collects, uses, stores, shares, protects, and otherwise processes Personal Data
              when you access or use the Uniscope website, mobile application, communication tools, mentor
              marketplace, and related services (collectively, the &ldquo;Platform&rdquo;).
            </p>
            <p>
              UNISCOPE is a technology platform owned and operated by AMSEL GOLD (bearing GSTIN: 33CRHPP4257Q1Z3), a
              sole proprietorship concern of Pon Buvaneshwaran, incorporated and validly existing under the laws of
              India, and it&rsquo;s Subsidiary operating under the trade name &ldquo;UNISCOPE&rdquo;.
            </p>
            <p>
              Uniscope is a student discovery and guidance platform designed to help students and prospective
              students discover educational institutions and connect with verified current students and alumni who
              may share their personal, first-hand experiences of those institutions.
            </p>
            <p>
              Uniscope also enables eligible current students and alumni to provide ratings, reviews, and other
              experience-based feedback regarding institutions they currently attend or have previously attended.
              Such ratings and feedback are intended to provide prospective students with an additional reference
              point and a general understanding of the experiences reported by members of the student community.
            </p>
            <p>
              Ratings, reviews, opinions, and other user-generated information reflect the individual experiences
              and views of the respective users and do not constitute statements, representations, recommendations,
              endorsements, rankings, or guarantees by Uniscope regarding any institution, course, faculty member,
              programme, placement outcome, facilities, academic quality, or other aspect of an institution.
            </p>
            <p>
              Uniscope does not represent or warrant that every rating, review, or user-generated statement is
              complete, current, accurate, objective, or representative of the experience of all students.
              Experiences may differ between individuals, programmes, departments, campuses, academic years, and
              locations. Users should independently verify material information with the relevant institution or
              other authoritative sources before making educational, financial, or career decisions.
            </p>
            <p>
              Uniscope may apply verification, moderation, reporting, and other reasonable measures to maintain the
              integrity and safety of ratings and reviews, in accordance with its Terms and Conditions, Community
              Guidelines, Privacy Policy, and applicable law.
            </p>
            <p>
              By registering, clicking an acceptance button, booking or providing a Session, accessing the Platform,
              or otherwise using a Uniscope service, you agree to these Terms, the Privacy Policy, Refund and
              Cancellation Policy, Community Guidelines, and other policies incorporated into these Terms. If you do
              not agree to these Terms, you must not access, register for, or use the Platform.
            </p>
          </Section>

          <Section title="2. Applicable Law and Role">
            <p>
              2.1 Uniscope will process Personal Data in accordance with Applicable Law, including the Digital
              Personal Data Protection Act, 2023 (&ldquo;DPDP Act&rdquo;) and applicable rules, regulations,
              notifications, and other legal requirements applicable to Uniscope from time to time.
            </p>
            <p>
              2.2 Third-party service providers processing Personal Data on behalf of Uniscope may act as Data
              Processors, while certain third parties may process Personal Data under their own independent legal
              responsibilities.
            </p>
            <p>
              2.3 Where consent is required under Applicable Law, Uniscope will provide an appropriate notice and
              obtain consent through a clear and appropriate mechanism. Where Applicable Law permits processing
              without consent, Uniscope may process Personal Data on the applicable lawful basis or permitted use.
            </p>
            <p>
              2.4 The specific basis and manner of processing may depend on the service being used, the nature of
              the Personal Data, and the requirements of Applicable Law applicable to that processing activity.
            </p>
          </Section>

          <Section title="3. Who This Policy Applies To">
            <p>
              3.1 This Privacy Policy applies to all Aspirants, Mentors, visitors, and other Users who access or use
              the Uniscope Platform.
            </p>
            <p>
              3.2 It applies to Personal Data collected or processed through the Uniscope website, mobile
              application, in-app messaging and calling features, Session bookings, payments and payouts, Mentor
              verification, ratings and reviews, support and reporting channels, and other interactions with the
              Platform.
            </p>
            <p>
              3.3 This Policy should be read together with Uniscope&rsquo;s Terms and Conditions, Refund and
              Cancellation Policy, and Community Guidelines, as applicable to the services used by the User.
            </p>
          </Section>

          <Section title="4. Personal Data We May Collect">
            <p>
              4.1 Depending on your role and the services you use, Uniscope may process the following categories of
              Personal Data:
            </p>

            <SubSection title="4.2 Account & Contact Information">
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Name</li>
                <li>Mobile number</li>
                <li>Email address</li>
                <li>Account details</li>
                <li>Authentication information</li>
              </ul>
            </SubSection>

            <SubSection title="4.3 Aspirant Profile Information">
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Name</li>
                <li>Gender</li>
                <li>State and city</li>
                <li>Academic qualification</li>
                <li>Current educational status</li>
                <li>Field or stream of interest</li>
                <li>Career goals</li>
                <li>Preferred languages</li>
              </ul>
            </SubSection>

            <SubSection title="4.4 Mentor Profile Information">
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Name</li>
                <li>Gender</li>
                <li>State and city</li>
                <li>Institution</li>
                <li>Degree or level of study</li>
                <li>Field or stream</li>
                <li>Current or previous academic status</li>
                <li>Year of study or graduation</li>
                <li>Areas of expertise</li>
                <li>Biography</li>
                <li>Preferred languages</li>
                <li>Available timing</li>
              </ul>
            </SubSection>

            <SubSection title="4.5 Mentor Verification Information">
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Institution identity card or</li>
                <li>Admission letter or</li>
                <li>Enrolment certificate or</li>
                <li>Degree or graduation certificate or</li>
                <li>Any other official student-portal evidence</li>
                <li>Other documents used to verify Institution association</li>
              </ul>
            </SubSection>

            <SubSection title="4.6 Institution & Course Information">
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Institution name</li>
                <li>Course</li>
                <li>Degree</li>
                <li>Department</li>
                <li>Stream</li>
                <li>Year of study</li>
                <li>Graduation year</li>
                <li>Other related educational information</li>
              </ul>
            </SubSection>

            <SubSection title="4.7 Ratings, Reviews & User Content">
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Ratings</li>
                <li>Reviews</li>
                <li>Feedback</li>
                <li>Biographies</li>
                <li>Photographs</li>
                <li>Audio</li>
                <li>Video</li>
                <li>Messages</li>
                <li>Other content submitted by Users</li>
              </ul>
            </SubSection>

            <SubSection title="4.8 Chat, Calling & Session Information">
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Chat messages</li>
                <li>Session bookings</li>
                <li>Session status</li>
                <li>Time stamps</li>
                <li>Technical meta data</li>
                <li>Reports</li>
                <li>Complaints</li>
                <li>Information required to provide and secure communication services</li>
              </ul>
            </SubSection>

            <SubSection title="4.9 Payment & Payout Information">
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Transaction details</li>
                <li>Payment status</li>
                <li>Payout information</li>
                <li>Banking information</li>
                <li>Tax-related information</li>
                <li>Refund records</li>
                <li>Dispute records</li>
                <li>Other related financial records</li>
              </ul>
            </SubSection>

            <SubSection title="4.10 Support & Safety Information">
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Complaints</li>
                <li>Reports</li>
                <li>Support requests</li>
                <li>Moderation records</li>
                <li>Dispute information</li>
                <li>Information provided for safety or policy enforcement</li>
              </ul>
            </SubSection>

            <SubSection title="4.11 Device & Technical Information">
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Device type</li>
                <li>Operating system</li>
                <li>Browser or application information</li>
                <li>IP address</li>
                <li>Device identifiers</li>
                <li>Network information</li>
                <li>Log information</li>
                <li>Crash information</li>
                <li>Security-related information</li>
              </ul>
            </SubSection>

            <SubSection title="4.12 Platform Usage Information">
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Searches</li>
                <li>Features accessed</li>
                <li>Platform interactions</li>
                <li>Bookings</li>
                <li>Session activity</li>
                <li>Preferences</li>
                <li>Other information relating to use of the Platform</li>
              </ul>
            </SubSection>

            <SubSection title="4.13 Legal & Compliance Information">
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Information required for identity verification</li>
                <li>Eligibility verification</li>
                <li>Fraud prevention</li>
                <li>Security</li>
                <li>Dispute resolution</li>
                <li>Legal compliance</li>
                <li>Responding to lawful requests</li>
              </ul>
            </SubSection>

            <SubSection title="4.14 Verification Material">
              <p>
                Verification documents submitted by Mentors are not publicly displayed merely because they are
                submitted and are handled in accordance with this Privacy Policy and Applicable Law.
              </p>
            </SubSection>
          </Section>

          <Section title="5. How We Collect Personal Data">
            <p>5.1 Uniscope may collect Personal Data directly from you when you:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Register for an account;</li>
              <li>Create or update your profile;</li>
              <li>Apply to become a Mentor;</li>
              <li>Submit Mentor verification documents;</li>
              <li>Book or provide a Session;</li>
              <li>Make or receive a payment or payout;</li>
              <li>Communicate through the Platform;</li>
              <li>Submit ratings, reviews, or feedback;</li>
              <li>Contact customer support;</li>
              <li>Submit a report, complaint, or grievance; or</li>
              <li>Otherwise provide information while using the Platform.</li>
            </ul>
            <p>
              5.2 Uniscope may also receive Personal Data from authorized service providers or other lawful sources
              where reasonably necessary for:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Mentor or identity verification;</li>
              <li>Payment processing and payouts;</li>
              <li>Security and fraud prevention;</li>
              <li>Platform safety and moderation;</li>
              <li>Legal and regulatory compliance; or</li>
              <li>Other legitimate Platform operations.</li>
            </ul>
          </Section>

          <Section title="6. Purposes of Processing">
            <p>Uniscope may collect and use Personal Data for the following purposes:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <span className="font-bold text-ink">Verify User Accounts</span> – To create, authenticate, verify,
                and maintain User accounts.
              </li>
              <li>
                <span className="font-bold text-ink">Verify Mentors</span> – To verify a Mentor&rsquo;s identity and
                current or previous association with an Institution.
              </li>
              <li>
                <span className="font-bold text-ink">Facilitate User Connections</span> – To help Aspirants
                discover, match with, and communicate with relevant Mentors.
              </li>
              <li>
                <span className="font-bold text-ink">Provide Platform Services</span> – To facilitate Sessions,
                bookings, payments, ratings, reviews, and other Platform features.
              </li>
              <li>
                <span className="font-bold text-ink">Improve Platform Functionality</span> – To maintain,
                troubleshoot, analyse, develop, and improve the Platform and its features.
              </li>
              <li>
                <span className="font-bold text-ink">Personalise User Experience</span> – To provide relevant Mentor
                discovery, recommendations, preferences, and other personalised Platform experiences.
              </li>
              <li>
                <span className="font-bold text-ink">Provide Customer Support</span> – To respond to questions,
                complaints, requests, reports, and other support communications.
              </li>
              <li>
                <span className="font-bold text-ink">Monitor Compliance</span> – To monitor compliance with the
                Terms and Conditions, Community Guidelines, Privacy Policy, and other Platform policies.
              </li>
              <li>
                <span className="font-bold text-ink">Investigate Misuse and Fraud</span> – To detect, investigate,
                prevent, and address fraud, impersonation, abuse, manipulation, and other misuse of the Platform.
              </li>
              <li>
                <span className="font-bold text-ink">Protect Users and Platform Security</span> – To maintain the
                safety, security, integrity, and reliability of Users and the Platform.
              </li>
              <li>
                <span className="font-bold text-ink">Process Payments and Payouts</span> – To facilitate
                transactions, refunds, Mentor payouts, payment verification, and related financial processes.
              </li>
              <li>
                <span className="font-bold text-ink">Comply with Legal Requirements</span> – To comply with
                applicable laws, regulations, legal proceedings, government directions, and lawful requests.
              </li>
              <li>
                <span className="font-bold text-ink">Enforce Legal Rights</span> – To establish, exercise, protect,
                or defend the legal rights and interests of Uniscope, its Users, or other relevant parties.
              </li>
            </ul>
          </Section>

          <Section title="7. Consent, Notice and User Rights">
            <p>
              7.1 Where consent is required under Applicable Law, Uniscope will provide a clear notice describing
              the Personal Data to be processed and the specific purposes for which it will be processed.
            </p>
            <p>
              7.2 Where Applicable Law permits Personal Data to be processed without consent, Uniscope may process
              such Personal Data on the applicable lawful basis or permitted legitimate use.
            </p>
            <p>
              7.3 Where applicable, Users may withdraw consent through the mechanisms provided by Uniscope and may
              exercise their available rights in accordance with this Privacy Policy and Applicable Law.
            </p>
            <p>7.4 Withdrawal of consent will not affect the lawfulness of processing carried out before such withdrawal.</p>
            <p>
              7.5 Withdrawal of consent does not require Uniscope to delete Personal Data where continued retention
              or processing is required or permitted under Applicable Law, including for legal compliance, security,
              fraud prevention, dispute resolution, or other lawful purposes.
            </p>
          </Section>

          <Section title="8. Mentor Verification">
            <p>
              8.1 To become a Mentor on Uniscope, a User may be required to provide valid documentation or other
              reliable evidence establishing their current or previous association with the Institution they claim
              to represent. Such documentation may include, without limitation:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Institution-issued identity card;</li>
              <li>Admission letter;</li>
              <li>Enrolment or registration certificate;</li>
              <li>Degree or graduation certificate;</li>
              <li>Official student-portal or institutional records; or</li>
              <li>Any other document or evidence reasonably accepted by Uniscope for verification purposes.</li>
            </ul>
            <p>
              8.2 Uniscope may manually review and verify the submitted information and supporting documentation to
              determine whether the User has a genuine current or former association with the stated Institution.
              Uniscope may use additional verification methods or sources where reasonably necessary to confirm the
              information provided.
            </p>
            <p>
              8.3 Successful verification confirms, to the extent reasonably established through Uniscope&rsquo;s
              verification process, the User&rsquo;s claimed association with the Institution. Verification does not
              constitute or imply any certification, endorsement, recommendation, or guarantee by Uniscope regarding
              the Mentor&rsquo;s character, conduct, competence, academic performance, professional qualifications,
              employment, opinions, or future behaviour.
            </p>
            <p>
              8.4 Mentors must ensure that all information and documents submitted for verification are genuine,
              accurate, current, complete, and unaltered. A User must not submit forged, fabricated, manipulated,
              misleading, or fraudulent documentation or information.
            </p>
            <p>
              8.5 Uniscope may reject a verification request where the submitted information or documentation is
              incomplete, inconsistent, suspicious, expired, unverifiable, or otherwise insufficient to establish the
              claimed association with the Institution.
            </p>
            <p>
              8.6 Uniscope may require a Mentor to undergo re-verification where reasonably necessary, including
              where the Mentor changes Institution, graduates, changes academic status, provides updated
              information, or where Uniscope has reason to believe that previously verified information may no
              longer be accurate or reliable.
            </p>
            <p>
              8.7 Uniscope may suspend, restrict, or revoke a Mentor&rsquo;s verification status or account where
              verification information is found to be false, misleading, fraudulent, outdated, or unverifiable, or
              where such action is reasonably necessary for the safety and integrity of the Platform or to comply
              with Applicable Law.
            </p>
            <p>
              8.8 Where Uniscope reasonably believes that forged, fraudulent, or otherwise unlawful documents or
              information have been submitted, it may take appropriate action, including suspension or termination
              of the account and, where required or legally permitted, reporting the matter to the relevant
              Institution, competent authority, law-enforcement agency, or other appropriate body.
            </p>
            <p>
              8.9 Verification documents and other information submitted for the verification process
              (&ldquo;Verification Material&rdquo;) are not intended to be publicly displayed on the Platform.
            </p>
            <p>
              8.10 Uniscope will collect, use, store, retain, disclose, and otherwise process Verification Material
              in accordance with its Privacy Policy and Applicable Law, including the Digital Personal Data
              Protection Act, 2023 (&ldquo;DPDP Act&rdquo;), applicable rules and regulations, and other applicable
              information-technology and data-protection requirements.
            </p>
            <p>
              8.11 Uniscope will implement reasonable technical and organisational safeguards appropriate to the
              nature of Verification Material to protect it against unauthorised access, disclosure, alteration,
              loss, misuse, or other unlawful processing, subject to the requirements of Applicable Law.
            </p>
          </Section>

          <Section title="9. Mentor Aliases and Public Profiles">
            <p>
              9.1 Mentors may use a platform-provided or self-selected display name or alias on their public profile
              instead of displaying their legal name. This alias is a privacy feature. The use of an alias is
              intended to protect Mentor privacy and encourage open and genuine sharing of experiences.
            </p>
            <p>
              9.2 Uniscope may retain and process the Mentor&rsquo;s verified legal identity and related information
              internally for purposes including verification, Platform safety, fraud prevention, payments,
              compliance, dispute resolution, and other lawful purposes.
            </p>
            <p>
              9.3 A Mentor&rsquo;s legal identity, verification documents, personal contact details, or other
              non-public personal information will not be publicly displayed through the Platform, except where the
              Mentor has expressly chosen to disclose such information or disclosure is required or permitted by
              Applicable Law.
            </p>
            <p>
              9.4 Users must not attempt to identify, trace, expose, publish, share, or otherwise disclose the real
              identity or private contact information of another User without their consent or lawful authority.
              Any such conduct may result in content removal, suspension, termination of the account, or other
              action under Uniscope&rsquo;s policies and Applicable Law.
            </p>
          </Section>

          <Section title="10. Aspirant Profiles">
            <p>
              10.1 Aspirants may be required to provide information such as their name, gender, state and city,
              academic qualification, current educational status, field or stream of interest, career goals, and
              preferred languages to create and use their Uniscope profile.
            </p>
            <p>
              10.2 The information provided by an Aspirant may be used to personalise the Platform experience,
              including Mentor discovery, recommendations, communication, Session-related services, safety, fraud
              prevention, and other legitimate Platform operations.
            </p>
            <p>
              10.3 Aspirants are responsible for ensuring that the information provided in their profile is
              accurate, current, and not misleading. Aspirants may update or modify their profile information
              through the Platform, subject to applicable feature and verification requirements.
            </p>
            <p>
              10.4 The collection, use, storage, disclosure, and protection of Aspirant information will be governed
              by Uniscope&rsquo;s Privacy Policy and Applicable Law, including the Digital Personal Data Protection
              Act, 2023.
            </p>
          </Section>

          <Section title="11. In-App Chat and Calling">
            <p>
              11.1 Where enabled, Uniscope&rsquo;s built-in chat and calling features allow Users to communicate
              without requiring them to exchange personal telephone numbers or other direct contact details. Users
              should use these features responsibly and should not pressure or require another User to move
              communications outside the Platform.
            </p>
            <p>11.2 Users must not:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Share passwords, OTPs, financial credentials, or unnecessary identity documents.</li>
              <li>Request or disclose sensitive personal information without a legitimate reason.</li>
              <li>
                Use the communication features for harassment, threats, stalking, sexual misconduct, fraud, spam,
                or any unlawful activity.
              </li>
              <li>Pressure another User to disclose their real identity, personal contact details, or other private information.</li>
              <li>Attempt to bypass Uniscope&rsquo;s payment, safety, verification, or communication systems.</li>
            </ul>
            <p>
              11.3 Users must not capture, screenshot, screen-record, copy, reproduce, publish, or distribute
              private conversations, calls, profiles, or personal information obtained through Uniscope without the
              consent of the relevant person, except where such action is required or expressly permitted by
              Applicable Law.
            </p>
            <p>
              11.4 Accepting or participating in a call through Uniscope does not, by itself, constitute consent to
              the recording of the call, screen recording, photography, screenshotting, or any other capture or
              reproduction of the conversation or content displayed during the call.
            </p>
            <p>
              11.5 Uniscope may investigate reports relating to communications and may access, preserve, or disclose
              relevant information where reasonably necessary for safety, security, fraud prevention, dispute
              resolution, or compliance with Applicable Law.
            </p>
          </Section>

          <Section title="12. Ratings, Reviews and User Content">
            <p>12.1 Users retain ownership of the User Content they submit or upload to Uniscope.</p>
            <p>
              12.2 By submitting User Content, Users permit Uniscope to host, store, display, format, transmit,
              moderate, secure, and otherwise process such content as reasonably necessary to provide, operate,
              maintain, improve, and protect the Platform, subject to the Terms, this Privacy Policy, the
              User&rsquo;s privacy choices, and Applicable Law.
            </p>
            <p>
              12.3 User Content may include ratings, reviews, feedback, biographies, photographs, audio, video,
              messages, and other content submitted through the Platform.
            </p>
            <p>
              12.4 Ratings and reviews are intended to provide prospective students with additional insight into an
              Institution and represent the individual experiences and opinions of the respective Users. They do
              not constitute endorsements, rankings, recommendations, or guarantees by Uniscope.
            </p>
            <p>
              12.5 Uniscope may review, moderate, restrict, remove, or limit the visibility of User Content where
              reasonably necessary to enforce Platform policies, protect Users, prevent misuse, address privacy or
              intellectual-property concerns, comply with Applicable Law, or maintain the safety and integrity of
              the Platform.
            </p>
            <p>
              12.6 Users are responsible for ensuring that the User Content they submit is lawful and does not
              knowingly infringe the privacy, confidentiality, intellectual-property, or other rights of another
              person or entity.
            </p>
          </Section>

          <Section title="13. Payments and Mentor Payouts">
            <p>
              13.1 Where paid Sessions or other paid services are offered, the applicable Session fee, platform
              fees, taxes, payment-processing charges, and any other applicable charges will be displayed to the
              User before payment is completed.
            </p>
            <p>
              13.2 Payments may be processed through third-party payment gateways or other authorised payment
              providers. Users must provide accurate payment information and comply with the applicable terms of
              the payment provider.
            </p>
            <p>
              13.3 Mentors may be required to complete identity, banking, tax, or other verification before
              becoming eligible to receive payouts. Payouts will be processed in accordance with Uniscope&rsquo;s
              applicable payout schedule and policies.
            </p>
            <p>
              13.4 Uniscope may delay, suspend, withhold, or adjust a payout where reasonably necessary due to
              fraud or security checks, disputes, refunds, cancellation, suspected policy violations, incomplete
              verification, legal requirements, or payment-provider restrictions.
            </p>
            <p>
              13.5 Mentors are responsible for any taxes, fees, or other statutory obligations arising from amounts
              received through Uniscope, except where Uniscope is required by Applicable Law to deduct, withhold,
              collect, or remit such amounts.
            </p>
            <p>
              13.6 Users must not attempt to bypass Uniscope&rsquo;s payment system or arrange payments outside the
              Platform for services offered through Uniscope, where doing so is intended to avoid applicable
              Platform fees, safeguards, or policies.
            </p>
          </Section>

          <Section title="14. Third-Party Service Providers">
            <p>
              14.1 Uniscope may use third-party service providers for payment processing, hosting, communications,
              analytics, security, customer support, infrastructure, and other Platform functions.
            </p>
            <p>
              14.2 Where a third-party provider processes Personal Data on behalf of Uniscope, Uniscope will
              maintain appropriate contractual and legal arrangements in accordance with Applicable Law.
            </p>
            <p>
              14.3 Uniscope will share Personal Data with third-party providers only to the extent reasonably
              necessary for the relevant service, Platform operation, security, compliance, or other purposes
              described in this Privacy Policy and permitted by Applicable Law.
            </p>
          </Section>

          <Section title="15. Cookies and Technical Technologies">
            <p>15.1 Uniscope may use cookies, Software Development Kits (SDKs), pixels, logs, and similar technologies to:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Keep the Platform functional and secure;</li>
              <li>Remember User preferences and settings;</li>
              <li>Understand how Users interact with the Platform;</li>
              <li>Monitor and maintain Platform security;</li>
              <li>Diagnose technical issues and errors;</li>
              <li>Analyse Platform performance and usage; and</li>
              <li>Improve and develop Platform features and services.</li>
            </ul>
            <p>
              15.2 Where required by Applicable Law, Uniscope will provide appropriate notice and obtain consent
              before using non-essential cookies or similar technologies.
            </p>
            <p>
              15.3 Users may be able to manage or disable certain cookies and similar technologies through their
              browser, device, or Platform settings. Disabling technologies that are necessary for Platform
              functionality may affect the availability or performance of certain features.
            </p>
          </Section>

          <Section title="16. Marketing Communications">
            <p>
              Uniscope may send essential communications relating to accounts, security, bookings, Sessions,
              transactions, support, and legal or policy changes.
            </p>
            <p>
              Marketing and promotional communications will be sent in accordance with Applicable Law and applicable
              consent requirements. Users may opt out through available unsubscribe or preference controls. Opting
              out of marketing does not prevent essential service, security, transactional, or legal communications.
            </p>
          </Section>

          <Section title="17. Data Sharing and Disclosure">
            <p>
              Uniscope may disclose or preserve Personal Data where required or permitted by Applicable Law,
              including in response to lawful notices, court orders, government directions, competent-authority
              requests, fraud investigations, security incidents, or protection of legal rights.
            </p>
            <p>Uniscope does not publicly display Mentor verification documents merely because they are submitted.</p>
          </Section>

          <Section title="18. Data Security and Breaches">
            <p>
              18.1 Uniscope&rsquo;s collection, use, storage, disclosure, and other processing of Personal Data is
              governed by its Privacy Policy and Applicable Law, including the Digital Personal Data Protection Act,
              2023 (&ldquo;DPDP Act&rdquo;) and applicable rules, regulations, and notifications.
            </p>
            <p>
              18.2 Third-party service providers processing Personal Data on behalf of Uniscope may act as Data
              Processors, subject to appropriate contractual and legal requirements.
            </p>
            <p>
              18.3 Uniscope will implement appropriate privacy notices, consent mechanisms where required, security
              safeguards, retention and deletion practices, grievance mechanisms, and other measures applicable to
              its processing activities under Applicable Law.
            </p>
            <p>
              18.4 Users should refer to the Privacy Policy for details regarding the Personal Data collected by
              Uniscope, the purposes of processing, data sharing, retention, security measures, and the rights and
              choices available to Users.
            </p>
          </Section>

          <Section title="19. Data Retention and Deletion">
            <p>
              19.1 Uniscope will retain Personal Data only for as long as reasonably necessary to fulfil the
              purposes for which it was collected or where retention is required or permitted by Applicable Law.
            </p>
            <p>
              19.2 Certain information, including Mentor verification records, payment and payout records,
              fraud-prevention records, dispute records, tax records, security logs, and records required for legal
              compliance, may need to be retained for longer periods.
            </p>
            <p>
              19.3 When Personal Data is no longer required and there is no lawful basis or obligation for continued
              retention, Uniscope will securely delete or anonymise the information in accordance with its
              applicable retention and deletion procedures.
            </p>
            <p>
              19.4 Deletion of an account does not necessarily result in immediate deletion of all Personal Data
              where continued retention is required or permitted by Applicable Law.
            </p>
          </Section>

          <Section title="20. User Rights and Grievances">
            <p>
              20.1 Subject to Applicable Law and the rights and mechanisms applicable to Uniscope from time to time,
              Users may have the following rights in relation to their Personal Data:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <span className="font-bold text-ink">Right to Access</span> – To request information about the
                Personal Data processed by Uniscope and, where applicable, information relating to such processing.
              </li>
              <li>
                <span className="font-bold text-ink">Right to Correction</span> – To request correction or updating
                of inaccurate or incomplete Personal Data.
              </li>
              <li>
                <span className="font-bold text-ink">Right to Erasure</span> – To request deletion of Personal Data
                where such deletion is available under Applicable Law.
              </li>
              <li>
                <span className="font-bold text-ink">Right to Withdraw Consent</span> – Where processing is based on
                consent, to withdraw such consent through the mechanisms provided by Uniscope.
              </li>
              <li>
                <span className="font-bold text-ink">Right to Grievance Redressal</span> – To raise concerns or
                complaints regarding the processing of Personal Data through Uniscope&rsquo;s designated grievance
                mechanism.
              </li>
              <li>
                <span className="font-bold text-ink">Other Rights</span> – To exercise any other rights that may be
                available under Applicable Law from time to time.
              </li>
            </ul>
            <p>20.2 Users may submit requests or grievances through the contact details provided in this Privacy Policy.</p>
            <p>
              20.3 Uniscope may verify the identity of the person making a request before processing it,
              particularly where the request involves access, correction, deletion, or disclosure of Personal Data.
            </p>
            <p>
              20.4 Requests may be subject to applicable legal limitations, exceptions, verification requirements,
              and lawful retention obligations. Uniscope may retain or continue processing Personal Data where
              required or permitted by Applicable Law.
            </p>
            <p>
              20.5 Uniscope will process and respond to valid requests within the timeframes and in the manner
              required by Applicable Law.
            </p>
          </Section>

          <Section title="21. Children and Minors">
            <p>
              The DPDP Act defines a child as a person who has not completed eighteen (18) years. Uniscope does not
              permit individuals under eighteen (18) years of age to use the Platform. Accordingly, Uniscope does
              not intentionally offer its services to or knowingly collect Personal Data from individuals under
              eighteen (18) years of age.
            </p>
            <p>
              Parents or lawful guardians who believe that a minor has created an account or provided Personal Data
              to Uniscope may contact{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-600 font-bold hover:underline">
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </Section>

          <Section title="22. Cross-Border Processing">
            <p>
              Personal Data may be processed or stored by Uniscope or authorised service providers in jurisdictions
              outside the User&rsquo;s location where permitted by Applicable Law. Where cross-border transfer or
              access is subject to legal restrictions, Uniscope will apply the requirements applicable to such
              transfers.
            </p>
          </Section>

          <Section title="23. Legal Requests">
            <p>
              Uniscope may respond to lawful notices, court orders, government directions, competent-authority
              requests, and valid rights complaints. Where legally required, information may be preserved or
              disclosed to competent authorities. Nothing prevents Users from exercising rights available under law.
            </p>
          </Section>

          <Section title="24. Changes to this Privacy Policy">
            <p>
              Uniscope may update this Privacy Policy to reflect changes to the Platform, business practices,
              security measures, legal requirements, or regulatory developments. Material changes will be
              communicated by reasonable means where required.
            </p>
            <p>The updated Policy will state the revised Last Updated date. Users should review the Policy periodically.</p>
          </Section>

          <Section title="25. Contact and Grievance Redressal">
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
