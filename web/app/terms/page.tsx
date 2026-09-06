import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "../../components/SiteNav";

export const metadata: Metadata = {
  title: "Terms and Conditions — Uniscope",
  description:
    "The Terms and Conditions governing access to and use of the Uniscope platform, website, and mobile application.",
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

export default function TermsPage() {
  return (
    <>
      <SiteNav />
      <main className="px-6 py-14">
        <div className="max-w-[720px] mx-auto">
          <p className="text-[12.5px] font-extrabold uppercase tracking-wide text-blue-600">Legal</p>
          <h1 className="mt-2 text-[clamp(26px,4vw,36px)] font-extrabold text-ink text-wrap-balance">
            Terms and Conditions
          </h1>

          <Section title="Acceptance & Legal Framework">
            <p>{`Welcome to Uniscope. By accessing, registering on, or using Uniscope ("Platform", "Website", "Company", "we", "our", or "us"), you ("User", "Member", or "you") agree to be bound by these Terms and Conditions. This Platform operates as an "intermediary" as defined under Section 2(1)(w) of the Information Technology Act, 2000 and complies with the Digital Personal Data Protection Act, 2023.`}</p>
            <p>{`UNISCOPE is a technology platform owned and operated by AMSEL GOLD (bearing GSTIN: 33CRHPP4257Q1Z3), a sole proprietorship concern of Pon Buvaneshwaran, incorporated and validly existing under the laws of India, and its Subsidiary operating under the trade name "UNISCOPE", having its registered office at NO 8, SELVA NAGAR, EETTI THERU, METTUPPATTI, PUDUKKOTTAI, TAMIL NADU, INDIA-622303.`}</p>
            <p>{`If you do not agree with any provision of these Terms, you must immediately discontinue use of the Platform.`}</p>
          </Section>

          <Section title="1. Purpose and Acceptance">
            <p>{`These Terms and Conditions ("Terms") govern access to and use of the Uniscope website, mobile application, software, communication tools, mentor marketplace, and related services (collectively, the "Platform"). Uniscope is a student discovery and guidance platform designed to help students and prospective students discover educational institutions and connect with verified current students and alumni who may share their personal, first-hand experiences of those institutions.`}</p>
            <p>{`Uniscope also enables eligible current students and alumni to provide ratings, reviews, and other experience-based feedback regarding institutions they currently attend or have previously attended. Such ratings and feedback are intended to provide prospective students with an additional reference point and a general understanding of the experiences reported by members of the student community.`}</p>
            <p>{`Ratings, reviews, opinions, and other user-generated information reflect the individual experiences and views of the respective users and do not constitute statements, representations, recommendations, endorsements, rankings, or guarantees by Uniscope regarding any institution, course, faculty member, programme, placement outcome, facilities, academic quality, or other aspect of an institution.`}</p>
            <p>{`Uniscope does not represent or warrant that every rating, review, or user-generated statement is complete, current, accurate, objective, or representative of the experience of all students. Experiences may differ between individuals, programmes, departments, campuses, academic years, and locations. Users should independently verify material information with the relevant institution or other authoritative sources before making educational, financial, or career decisions.`}</p>
            <p>{`Uniscope may apply verification, moderation, reporting, and other reasonable measures to maintain the integrity and safety of ratings and reviews, in accordance with its Terms and Conditions, Community Guidelines, Privacy Policy, and applicable law.`}</p>
            <p>{`By registering, clicking an acceptance button, booking or providing a Session, accessing the Platform, or otherwise using a Uniscope service, you agree to these Terms, the Privacy Policy, Refund and Cancellation Policy, Community Guidelines, and other policies incorporated into these Terms. If you do not agree, do not use the Platform.`}</p>
          </Section>

          <Section title="2. Definitions">
            <ol className="list-decimal pl-5 space-y-1.5">
              <li>{`"Aspirant" or "Student" means a person using Uniscope to discover institutions, courses, mentors, or guidance.`}</li>
              <li>{`"Mentor" means a current student or graduate accepted by Uniscope after verification.`}</li>
              <li>{`"User" means an Aspirant, Mentor, visitor, or other person accessing the Platform.`}</li>
              <li>{`"Institution" means a school, college, university, institute, academy, training provider, or other educational organisation.`}</li>
              <li>{`"Session" means a chat, voice call, or other mentorship interaction made available through Uniscope.`}</li>
              <li>{`"User Content" means messages, answers, biographies, photos, audio, video, ratings, feedback, and other material submitted by a User.`}</li>
              <li>{`"Verification Material" means documents or information supplied to establish a Mentor's association with an Institution.`}</li>
              <li>{`"Personal Data" means digital personal data under applicable Digital Personal Data Protection Act (DPDP), 2023 law.`}</li>
              <li>{`"Applicable Law" means laws, rules, regulations, notifications, orders, and governmental directions applicable to the Platform or User.`}</li>
              <li>{`"Uniscope", "we", "us" means AMSEL GOLD, a sole proprietorship incorporated and validly existing under the laws of India, and its Subsidiary operating under the trade name "UNISCOPE", having its registered office at NO 8, SELVA NAGAR, EETTI THERU, METTUPPATTI, PUDUKKOTTAI, TAMIL NADU, INDIA-622303.`}</li>
            </ol>
          </Section>

          <Section title="3. About Uniscope">
            <p>{`Uniscope is a student discovery and peer-guidance platform connecting Aspirants with verified Mentors across fields including medicine, dentistry, engineering, law, business, commerce, arts and sciences, design, architecture, technology, and other disciplines.`}</p>
            <p>{`Uniscope also enables eligible current students and alumni to provide ratings, reviews, and other experience-based feedback regarding institutions they currently attend or have previously attended. Such ratings and feedback are intended to provide prospective students with an additional reference point and a general understanding of the experiences reported by members of the student community.`}</p>
            <p>{`Uniscope does not own, control, accredit, rank, certify, or represent any Institution unless expressly stated. A Mentor's views are personal experiences and are not statements or official positions of Uniscope or the Institution.`}</p>
          </Section>

          <Section title="4. Eligibility and Age">
            <p>{`4.1 Users must be at least eighteen (18) years of age to register for, access, or use the Uniscope Platform. By creating an account or using the Platform, you represent and warrant that you are eighteen (18) years of age or older.`}</p>
            <p>{`4.2 Uniscope does not permit individuals under the age of eighteen (18) years ("Minors") to register for, access, or use the Platform, including its Mentor, Aspirant, messaging, calling, booking, and other services.`}</p>
            <p>{`4.3 Uniscope does not knowingly collect or intentionally process Personal Data of Minors for the purpose of providing Platform services. If Uniscope becomes aware that an account belongs to a person under eighteen (18) years of age, we may immediately suspend or terminate the account and take reasonable steps to delete the associated Personal Data, subject to any retention required or permitted by Applicable Law.`}</p>
            <p>{`4.4 Users must provide accurate and truthful information regarding their age, identity, educational status, and other registration details. Users must not misrepresent or conceal their age in order to access the Platform.`}</p>
            <p>{`4.5 Uniscope reserves the right to request age or identity verification where reasonably necessary to enforce this age restriction, protect Users, prevent fraud, or comply with Applicable Law.`}</p>
            <p>{`4.6 Uniscope reserves the right to suspend or terminate any account containing false, misleading, fraudulent, or materially inaccurate information, including false information relating to a User's age or identity.`}</p>
            <p>
              {`4.7 If you are a parent or lawful guardian and believe that a person under eighteen (18) years of age has created an account or provided Personal Data to Uniscope, please contact us at `}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-600 font-bold hover:underline">
                {CONTACT_EMAIL}
              </a>
              {`. We will review the request and take appropriate action in accordance with Applicable Law.`}
            </p>
          </Section>

          <Section title="5. Accounts and Registration">
            <p>{`5.1 Users must provide accurate, current, complete, and truthful information during registration and throughout their use of the Platform. Users must not impersonate or falsely represent themselves as another individual, Mentor, student, alumni, Institution, or representative of Uniscope. Users must not create, maintain, or use multiple accounts for the purpose of evading restrictions, circumventing Platform policies, manipulating ratings or rankings, obtaining unauthorised benefits, or otherwise abusing the Platform.`}</p>
            <p>{`5.2 Users are responsible for maintaining the confidentiality and security of their account credentials, including passwords, one-time passwords (OTPs), authentication codes, and any other account-access information. Users are also responsible for maintaining reasonable security of the devices through which they access the Platform. Users must promptly notify Uniscope if they suspect unauthorised access to, or use of, their account.`}</p>
            <p>{`5.3 Uniscope may require additional information, documentation, or verification from a User where reasonably necessary for identity verification, Mentor verification, age verification, fraud prevention, payment processing, account security, safety, regulatory compliance, or compliance with Applicable Law.`}</p>
            <p>{`5.4 Providing information or completing a verification process does not guarantee account approval, Mentor verification, access to any particular Platform feature, or continued access to the Platform. Uniscope may reject, restrict, suspend, or terminate an account where information cannot be reasonably verified or where it is necessary to protect Users, the Platform, or comply with Applicable Law.`}</p>
            <p>{`5.5 Users must not share, transfer, sell, or otherwise provide access to their Uniscope account to another person. A User remains responsible for activity carried out through their account, except where the User has promptly reported unauthorised access and the relevant circumstances are reasonably established.`}</p>
          </Section>

          <Section title="6. Mentor Verification">
            <p>{`6.1 To become a Mentor on Uniscope, a User may be required to provide valid documentation or other reliable evidence establishing their current or previous association with the Institution they claim to represent. Such documentation may include, without limitation:`}</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>{`Institution-issued identity card;`}</li>
              <li>{`Admission letter;`}</li>
              <li>{`Enrolment or registration certificate;`}</li>
              <li>{`Degree or graduation certificate;`}</li>
              <li>{`Official student-portal or institutional records; or`}</li>
              <li>{`Any other document or evidence reasonably accepted by Uniscope for verification purposes.`}</li>
            </ul>
            <p>{`6.2 Uniscope may manually review and verify the submitted information and supporting documentation to determine whether the User has a genuine current or former association with the stated Institution. Uniscope may use additional verification methods or sources where reasonably necessary to confirm the information provided.`}</p>
            <p>{`6.3 Successful verification confirms, to the extent reasonably established through Uniscope's verification process, the User's claimed association with the Institution. Verification does not constitute or imply any certification, endorsement, recommendation, or guarantee by Uniscope regarding the Mentor's character, conduct, competence, academic performance, professional qualifications, employment, opinions, or future behaviour.`}</p>
            <p>{`6.4 Mentors must ensure that all information and documents submitted for verification are genuine, accurate, current, complete, and unaltered. A User must not submit forged, fabricated, manipulated, misleading, or fraudulent documentation or information.`}</p>
            <p>{`6.5 Uniscope may reject a verification request where the submitted information or documentation is incomplete, inconsistent, suspicious, expired, unverifiable, or otherwise insufficient to establish the claimed association with the Institution.`}</p>
            <p>{`6.6 Uniscope may require a Mentor to undergo re-verification where reasonably necessary, including where the Mentor changes Institution, graduates, changes academic status, provides updated information, or where Uniscope has reason to believe that previously verified information may no longer be accurate or reliable.`}</p>
            <p>{`6.7 Uniscope may suspend, restrict, or revoke a Mentor's verification status or account where verification information is found to be false, misleading, fraudulent, outdated, or unverifiable, or where such action is reasonably necessary for the safety and integrity of the Platform or to comply with Applicable Law.`}</p>
            <p>{`6.8 Where Uniscope reasonably believes that forged, fraudulent, or otherwise unlawful documents or information have been submitted, it may take appropriate action, including suspension or termination of the account and, where required or legally permitted, reporting the matter to the relevant Institution, competent authority, law-enforcement agency, or other appropriate body.`}</p>
            <p>{`6.9 Verification documents and other information submitted for the verification process ("Verification Material") are not intended to be publicly displayed on the Platform.`}</p>
            <p>{`6.10 Uniscope will collect, use, store, retain, disclose, and otherwise process Verification Material in accordance with its Privacy Policy and Applicable Law, including the Digital Personal Data Protection Act, 2023 ("DPDP Act"), applicable rules and regulations, and other applicable information-technology and data-protection requirements.`}</p>
            <p>{`6.11 Uniscope will implement reasonable technical and organisational safeguards appropriate to the nature of Verification Material to protect it against unauthorised access, disclosure, alteration, loss, misuse, or other unlawful processing, subject to the requirements of Applicable Law.`}</p>
          </Section>

          <Section title="7. Mentor Profiles and Aliases">
            <p>{`7.1 Mentors may use a platform-provided or self-selected display name or alias on their public profile instead of displaying their legal name. This alias is a privacy feature. The use of an alias is intended to protect Mentor privacy and encourage open and genuine sharing of experiences.`}</p>
            <p>{`7.2 Uniscope may retain and process the Mentor's verified legal identity and related information internally for purposes including verification, Platform safety, fraud prevention, payments, compliance, dispute resolution, and other lawful purposes.`}</p>
            <p>{`7.3 A Mentor's legal identity, verification documents, personal contact details, or other non-public personal information will not be publicly displayed through the Platform, except where the Mentor has expressly chosen to disclose such information or disclosure is required or permitted by Applicable Law.`}</p>
            <p>{`7.4 Users must not attempt to identify, trace, expose, publish, share, or otherwise disclose the real identity or private contact information of another User without their consent or lawful authority. Any such conduct may result in content removal, suspension, termination of the account, or other action under Uniscope's policies and Applicable Law.`}</p>
          </Section>

          <Section title="8. Aspirant Profiles">
            <p>{`8.1 Aspirants may be required to provide information such as their name, gender, state and city, academic qualification, current educational status, field or stream of interest, career goals, and preferred languages to create and use their Uniscope profile.`}</p>
            <p>{`8.2 The information provided by an Aspirant may be used to personalise the Platform experience, including Mentor discovery, recommendations, communication, Session-related services, safety, fraud prevention, and other legitimate Platform operations.`}</p>
            <p>{`8.3 Aspirants are responsible for ensuring that the information provided in their profile is accurate, current, and not misleading. Aspirants may update or modify their profile information through the Platform, subject to applicable feature and verification requirements.`}</p>
            <p>{`8.4 The collection, use, storage, disclosure, and protection of Aspirant information will be governed by Uniscope's Privacy Policy and Applicable Law, including the Digital Personal Data Protection Act, 2023.`}</p>
          </Section>

          <Section title="9. Platform Services">
            <p>{`9.1 Uniscope provides services designed to help Aspirants discover educational institutions and courses and connect with verified Mentors. Depending on availability, these services may include institution and course discovery, Mentor discovery, in-app messaging, voice calling, Session booking, payments, Mentor payouts, ratings and feedback, reporting, moderation, and Mentor verification.`}</p>
            <p>{`9.2 Uniscope acts as a technology platform facilitating interactions between Aspirants and Mentors. Unless expressly stated otherwise, Uniscope does not provide the educational, academic, professional, or personal advice shared by Mentors and is not responsible for the individual opinions or experiences expressed by them.`}</p>
            <p>{`9.3 Uniscope may introduce, modify, suspend, restrict, or discontinue any Platform feature or service from time to time, subject to Applicable Law. Where reasonably required, Users will be notified of material changes affecting paid services or existing bookings.`}</p>
            <p>{`9.4 Uniscope also enables eligible current students and alumni to provide ratings, reviews, and other experience-based feedback regarding institutions they currently attend or have previously attended. Such ratings and feedback are intended to provide prospective students with an additional reference point and a general understanding of the experiences reported by members of the student community.`}</p>
          </Section>

          <Section title="10. In-App Chat and Calling: Do's and Don'ts">
            <p>{`10.1 Where enabled, Uniscope's built-in chat and calling features allow Users to communicate without requiring them to exchange personal telephone numbers or other direct contact details. Users should use these features responsibly and should not pressure or require another User to move communications outside the Platform.`}</p>
            <p>{`10.2 Users must not:`}</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>{`Share passwords, OTPs, financial credentials, or unnecessary identity documents.`}</li>
              <li>{`Request or disclose sensitive personal information without a legitimate reason.`}</li>
              <li>{`Use the communication features for harassment, threats, stalking, sexual misconduct, fraud, spam, or any unlawful activity.`}</li>
              <li>{`Pressure another User to disclose their real identity, personal contact details, or other private information.`}</li>
              <li>{`Attempt to bypass Uniscope's payment, safety, verification, or communication systems.`}</li>
            </ul>
            <p>{`10.3 Users must not capture, screenshot, screen-record, copy, reproduce, publish, or distribute private conversations, calls, profiles, or personal information obtained through Uniscope without the consent of the relevant person, except where such action is required or expressly permitted by Applicable Law.`}</p>
            <p>{`10.4 Accepting or participating in a call through Uniscope does not, by itself, constitute consent to the recording of the call, screen recording, photography, screenshotting, or any other capture or reproduction of the conversation or content displayed during the call.`}</p>
            <p>{`10.5 Uniscope may investigate reports relating to communications and may access, preserve, or disclose relevant information where reasonably necessary for safety, security, fraud prevention, dispute resolution, or compliance with Applicable Law.`}</p>
          </Section>

          <Section title="11. Mentor Services and Scope">
            <p>{`11.1 Mentors provide guidance based on their personal experiences, knowledge, and understanding of their Institution, course, or field of study. Mentor guidance is intended to help Aspirants make more informed decisions and does not constitute official advice from Uniscope or any Institution.`}</p>
            <p>{`11.2 Mentors are independent users of the Platform and are not employees, agents, admissions officers, placement officers, representatives, or authorised spokespersons of Uniscope or any Institution, unless expressly stated otherwise.`}</p>
            <p>{`11.3 Mentors must not guarantee or misrepresent any outcome, including admission, scholarships, placements, examination results, internships, visas, professional licensing, or employment.`}</p>
            <p>{`11.4 Mentors must not use the Platform to facilitate or promote academic cheating, examination impersonation, forged or fraudulent documents, unlawful admission practices, purchase or sale of admissions, bribery, or any other unlawful activity.`}</p>
            <p>{`11.5 Mentors must clearly distinguish their personal opinions and experiences from official information issued by an Institution or competent authority. Aspirants are encouraged to independently verify important information before making educational or career-related decisions.`}</p>
          </Section>

          <Section title="12. Accuracy and Educational Decisions">
            <p>{`12.1 Information relating to educational institutions, including policies, fees, cut-offs, seat availability, curriculum, placements, hostel facilities, clinical exposure, faculty, schedules, and other conditions, may change over time. Individual experiences may also differ based on the course, department, campus, academic year, or personal circumstances.`}</p>
            <p>{`12.2 Uniscope does not guarantee that information provided by Mentors, including ratings, reviews, opinions, or personal experiences, is complete, accurate, current, objective, or representative of all students or the Institution as a whole.`}</p>
            <p>{`12.3 Users should independently verify important or consequential information directly with the relevant Institution, examination authority, government authority, or other competent source before making educational, financial, legal, medical, immigration, or career-related decisions.`}</p>
            <p>{`12.4 Uniscope is intended to provide an additional source of student insight and does not replace official information, professional advice, or independent verification.`}</p>
          </Section>

          <Section title="13. Payments, Fees and Mentor Payouts">
            <p>{`13.1 Where paid Sessions or other paid services are offered, the applicable Session fee, platform fees, taxes, payment-processing charges, and any other applicable charges will be displayed to the User before payment is completed.`}</p>
            <p>{`13.2 Payments may be processed through third-party payment gateways or other authorised payment providers. Users must provide accurate payment information and comply with the applicable terms of the payment provider.`}</p>
            <p>{`13.3 Mentors may be required to complete identity, banking, tax, or other verification before becoming eligible to receive payouts. Payouts will be processed in accordance with Uniscope's applicable payout schedule and policies.`}</p>
            <p>{`13.4 Uniscope may delay, suspend, withhold, or adjust a payout where reasonably necessary due to fraud or security checks, disputes, refunds, cancellation, suspected policy violations, incomplete verification, legal requirements, or payment-provider restrictions.`}</p>
            <p>{`13.5 Mentors are responsible for any taxes, fees, or other statutory obligations arising from amounts received through Uniscope, except where Uniscope is required by Applicable Law to deduct, withhold, collect, or remit such amounts.`}</p>
            <p>{`13.6 Users must not attempt to bypass Uniscope's payment system or arrange payments outside the Platform for services offered through Uniscope, where doing so is intended to avoid applicable Platform fees, safeguards, or policies.`}</p>
          </Section>

          <Section title="14. Cancellation and Refunds">
            <p>{`14.1 Cancellations, rescheduling, refunds, and related payment adjustments are governed by Uniscope's Refund and Cancellation Policy, as applicable to the relevant service or Session.`}</p>
            <p>{`14.2 The Refund and Cancellation Policy may provide different rules depending on the circumstances, including Aspirant cancellations, Mentor cancellations or no-shows, Aspirant no-shows, technical failures, misconduct, duplicate payments, and partially completed Sessions.`}</p>
            <p>{`14.3 Users should review the applicable cancellation and refund terms before completing a booking or payment. Any refund will be processed in accordance with the applicable policy and payment-provider procedures.`}</p>
            <p>{`14.4 Nothing in these Terms or the Refund and Cancellation Policy is intended to exclude, restrict, or waive any statutory, consumer, or other legal rights that cannot lawfully be excluded or limited under Applicable Law.`}</p>
          </Section>

          <Section title="15. User-Generated Content">
            <p>{`15.1 Users retain ownership of the content they create and submit to Uniscope, including profiles, reviews, ratings, messages, photographs, audio, video, feedback, and other materials ("User Content").`}</p>
            <p>{`15.2 By submitting User Content, the User grants Uniscope a non-exclusive, worldwide, royalty-free licence to host, store, reproduce, transmit, display, format, moderate, and otherwise process such User Content as reasonably necessary to provide, operate, secure, maintain, improve, and promote the Platform, subject to the User's privacy choices, this Policy, and Applicable Law.`}</p>
            <p>{`15.3 The licence granted under this section does not transfer ownership of the User Content to Uniscope. It continues only for as long as reasonably necessary for the purposes described above or as otherwise required or permitted by Applicable Law.`}</p>
            <p>{`15.4 Users represent and warrant that they have the necessary rights and permissions to submit their User Content and that such content does not knowingly violate Applicable Law or infringe the intellectual-property, privacy, confidentiality, or other rights of any third party.`}</p>
            <p>{`15.5 Uniscope may remove, restrict, or modify the visibility of User Content where reasonably necessary to enforce its policies, protect Users, comply with Applicable Law, or maintain the safety and integrity of the Platform.`}</p>
          </Section>

          <Section title="16. Community Standards and Prohibited Content">
            <p>{`16.1 Users must use Uniscope respectfully, honestly, and lawfully. Users must not engage in or facilitate:`}</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>{`Harassment, bullying, threats, intimidation, stalking, or persistent unwanted contact.`}</li>
              <li>{`Sexual harassment, sexual exploitation, or inappropriate sexual conduct.`}</li>
              <li>{`Any exploitation, grooming, or inappropriate contact involving Minors.`}</li>
              <li>{`Unlawful discrimination, hate-based abuse, or targeted harassment.`}</li>
              <li>{`Fraud, impersonation, identity deception, or submission of forged or fraudulent documents.`}</li>
              <li>{`Academic cheating, examination impersonation, admission fraud, bribery, or other unlawful admission practices.`}</li>
              <li>{`Doxxing or unauthorised disclosure of another person's private or personal information.`}</li>
              <li>{`Knowingly false, deceptive, or maliciously misleading content intended to cause harm.`}</li>
              <li>{`Spam, phishing, scams, malware, or other harmful or deceptive activity.`}</li>
              <li>{`Unauthorised commercial solicitation or promotion.`}</li>
              <li>{`Infringement of intellectual-property, privacy, confidentiality, or other legal rights.`}</li>
              <li>{`Attempts to bypass or manipulate Uniscope's payment, verification, moderation, safety, security, or account-restriction systems.`}</li>
            </ul>
            <p>{`16.2 Nothing in this section prohibits genuine opinions, criticism, ratings, reviews, or negative experiences shared in good faith, provided they do not otherwise violate these Terms, the Community Guidelines, or Applicable Law.`}</p>
          </Section>

          <Section title="17. Reporting and Moderation">
            <p>{`17.1 We encourage users to report misconduct, unsafe behaviour, fraudulent verification, privacy violations, illegal content, or other violations of these Terms or Uniscope's policies through the Platform's reporting tools or published contact channels.`}</p>
            <p>{`17.2 Uniscope may review reports and take appropriate action, which may include restricting or removing content, pausing or cancelling Sessions, suspending or terminating accounts, revoking Mentor verification, restricting Platform access, or withholding or adjusting payouts, subject to Applicable Law and the relevant Platform policies.`}</p>
            <p>{`17.3 Enforcement decisions may consider the nature and severity of the conduct, available evidence, User history, repeated violations, potential safety risks, impact on other Users, and applicable legal or regulatory requirements.`}</p>
            <p>{`17.4 Uniscope may take immediate action where reasonably necessary to protect Users, prevent fraud or abuse, preserve evidence, or comply with Applicable Law. Where appropriate, Users may have access to an appeal or review process provided by Uniscope.`}</p>
          </Section>

          <Section title="18. Privacy and Data Protection">
            <p>{`18.1 Uniscope's collection, use, storage, disclosure, and other processing of Personal Data is governed by its Privacy Policy and Applicable Law, including the Digital Personal Data Protection Act, 2023 ("DPDP Act") and applicable rules, regulations, and notifications.`}</p>
            <p>{`18.2 Third-party service providers processing Personal Data on behalf of Uniscope may act as Data Processors, subject to appropriate contractual and legal requirements.`}</p>
            <p>{`18.3 Uniscope will implement appropriate privacy notices, consent mechanisms where required, security safeguards, retention and deletion practices, grievance mechanisms, and other measures applicable to its processing activities under Applicable Law.`}</p>
            <p>{`18.4 Users should refer to the Privacy Policy for details regarding the Personal Data collected by Uniscope, the purposes of processing, data sharing, retention, security measures, and the rights and choices available to Users.`}</p>
          </Section>

          <Section title="19. Personal Data We May Process">
            <p>{`19.1 Depending on the services used, Uniscope may process the following categories of Personal Data:`}</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>{`Account and contact information;`}</li>
              <li>{`Educational, academic, and profile information;`}</li>
              <li>{`Institution, course, and Mentor-related information;`}</li>
              <li>{`Mentor verification documents and verification records;`}</li>
              <li>{`Payment, payout, and applicable tax information;`}</li>
              <li>{`Messages, Session information, reports, feedback, and support communications; and`}</li>
              <li>{`Device, technical, security, and Platform usage information.`}</li>
            </ul>
            <p>{`19.2 The specific Personal Data collected will depend on the User's role, the services used, and the information voluntarily provided or required for verification, safety, payment, or legal compliance.`}</p>
            <p>{`19.3 Verification documents submitted by Mentors are collected for verification and related legitimate purposes and are not publicly displayed merely because they have been submitted to Uniscope. Their collection, use, storage, retention, and protection are governed by the Privacy Policy and Applicable Law.`}</p>
          </Section>

          <Section title="20. Consent, Notice and User Rights">
            <p>{`20.1 Where consent is required under Applicable Law, Uniscope will obtain consent through clear and appropriate mechanisms and provide relevant information regarding the Personal Data being processed and the purposes for which it is processed.`}</p>
            <p>{`20.2 Where Applicable Law permits Personal Data to be processed without consent, Uniscope may process such information on the applicable lawful basis or permitted use.`}</p>
            <p>{`20.3 Where applicable, Users may withdraw consent and exercise available rights relating to their Personal Data, including requesting access, correction, erasure, or raising a grievance, through the mechanisms described in the Privacy Policy.`}</p>
            <p>{`20.4 Withdrawal of consent will not affect the lawfulness of processing carried out before the withdrawal. Uniscope may also retain or continue processing certain Personal Data where required or permitted by Applicable Law, including for legal, security, fraud prevention, dispute resolution, or other lawful purposes.`}</p>
          </Section>

          <Section title="21. Children and Minors">
            <p>{`The DPDP Act defines a child as a person who has not completed eighteen (18) years. Uniscope does not permit individuals under eighteen (18) years of age to use the Platform. Accordingly, Uniscope does not intentionally offer its services to or knowingly collect Personal Data from individuals under eighteen (18) years of age.`}</p>
          </Section>

          <Section title="22. Security and Data Breach">
            <p>{`22.1 Uniscope will implement reasonable technical and organisational safeguards appropriate to the nature and sensitivity of the Personal Data it processes to protect it against unauthorised access, disclosure, alteration, loss, misuse, or other unlawful processing.`}</p>
            <p>{`22.2 Such safeguards may include access controls, authentication measures, secure storage, encryption where appropriate, monitoring, and other security measures appropriate to the risks involved.`}</p>
            <p>{`22.3 While Uniscope takes reasonable measures to protect Personal Data, no internet-based service or electronic transmission can be guaranteed to be completely secure.`}</p>
            <p>{`22.4 In the event of a Personal Data breach, Uniscope will take reasonable steps to contain, investigate, mitigate, and remediate the breach and will make notifications or take other actions required under Applicable Law.`}</p>
          </Section>

          <Section title="23. Data Retention and Deletion">
            <p>{`23.1 Uniscope will retain Personal Data only for as long as reasonably necessary to fulfil the purposes for which it was collected or where retention is required or permitted by Applicable Law.`}</p>
            <p>{`23.2 Certain information, including Mentor verification records, payment and payout records, fraud-prevention records, dispute records, tax records, security logs, and records required for legal compliance, may need to be retained for longer periods.`}</p>
            <p>{`23.3 When Personal Data is no longer required and there is no lawful basis or obligation for continued retention, Uniscope will securely delete or anonymise the information in accordance with its applicable retention and deletion procedures.`}</p>
            <p>{`23.4 Deletion of an account does not necessarily result in immediate deletion of all Personal Data where continued retention is required or permitted by Applicable Law.`}</p>
          </Section>

          <Section title="24. Third-Party Services">
            <p>{`The Platform may use third parties for payments, communications, hosting, analytics, security, and support. Third parties may have separate terms and privacy notices. Uniscope will maintain appropriate contractual and legal arrangements for processing it controls, while third parties may have their own legal roles.`}</p>
          </Section>

          <Section title="25. Intellectual Property">
            <p>{`The Platform, software, design, branding, logos, trademarks, databases, interface, text, graphics, and proprietary materials are owned by or licensed to Uniscope. Except as expressly permitted, Users may not copy, modify, reverse engineer, scrape, republish, sell, distribute, or create derivative works from the Platform.`}</p>
          </Section>

          <Section title="26. Feedback">
            <p>{`Suggestions or feedback may be used by Uniscope without restriction or compensation, provided such use does not disclose Personal Data inconsistently with the Privacy Policy or Applicable Law.`}</p>
          </Section>

          <Section title="27. Availability">
            <p>{`Uniscope does not guarantee uninterrupted, error-free, secure, or continuously available operation. The Platform may be affected by maintenance, outages, third-party failures, network problems, cyber incidents, or events beyond reasonable control.`}</p>
          </Section>

          <Section title="28. Disclaimers">
            <p>{`To the maximum extent permitted by law, the Platform and User-generated information are provided on an "as is" and "as available" basis. Uniscope does not warrant that Mentor information is accurate, complete, current, unbiased, or suitable for a particular User, and does not guarantee admission, employment, examination results, placements, scholarships, visas, licensing, or other outcomes.`}</p>
          </Section>

          <Section title="29. Limitation of Liability">
            <p>{`29.1 To the maximum extent permitted by Applicable Law, Uniscope will not be liable for any indirect, incidental, special, consequential, exemplary, or punitive loss or damage, including loss of profits, opportunity, reputation, or data, arising from or relating to the use of the Platform or reliance on User-generated content.`}</p>
            <p>{`29.2 Uniscope is not responsible for decisions made by Users based on information, ratings, reviews, opinions, or guidance provided by other Users, including Mentors.`}</p>
            <p>{`29.3 Nothing in these Terms excludes or limits any liability, right, or remedy that cannot lawfully be excluded or limited under Applicable Law, including applicable consumer-protection rights.`}</p>
          </Section>

          <Section title="30. Indemnity">
            <p>{`30.1 To the extent permitted by Applicable Law, Users agree to indemnify and hold harmless Uniscope, its officers, employees, contractors, and service providers from claims, losses, liabilities, damages, costs, and reasonable expenses arising out of or relating to:`}</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>{`The User's breach of these Terms or applicable Platform policies;`}</li>
              <li>{`The User's unlawful, fraudulent, or negligent conduct;`}</li>
              <li>{`The User's infringement or violation of any third-party rights; or`}</li>
              <li>{`The User's misuse of the Platform.`}</li>
            </ul>
            <p>{`30.2 This indemnification obligation will not apply to the extent that a claim or loss results from Uniscope's own unlawful conduct, negligence, or wilful misconduct.`}</p>
            <p>{`30.3 Nothing in this section requires a User to indemnify Uniscope to the extent such an obligation is prohibited or restricted by Applicable Law.`}</p>
          </Section>

          <Section title="31. Suspension and Termination">
            <p>{`31.1 Uniscope may suspend, restrict, or terminate a User's account or access to any Platform feature where reasonably necessary for User safety, fraud prevention, security, legal compliance, or a material or repeated breach of these Terms or applicable Platform policies.`}</p>
            <p>{`31.2 Uniscope may take immediate action where reasonably necessary to prevent harm, protect other Users, investigate suspected fraud or abuse, preserve Platform integrity, or comply with Applicable Law.`}</p>
            <p>{`31.3 Where appropriate, Users may be notified of the reason for suspension or termination and may have access to an applicable review or appeal process, subject to safety, security, privacy, and legal considerations.`}</p>
            <p>{`31.4 Termination or suspension of an account does not affect obligations or rights that, by their nature, are intended to survive termination, including provisions relating to intellectual property, payments and outstanding obligations, confidentiality, User Content, indemnification, limitation of liability, dispute resolution, and lawful data retention.`}</p>
          </Section>

          <Section title="32. Grievance Redressal">
            <p>{`Uniscope will publish the contact details of the person designated to receive grievances or data-related requests where required by Applicable Law.`}</p>
            <ul className="list-none space-y-1">
              <li>{`Grievance Officer: Mr. PON BUVANESHWARAN`}</li>
              <li>
                {`Email: `}
                <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-600 font-bold hover:underline">
                  {CONTACT_EMAIL}
                </a>
              </li>
              <li>{`Phone: +91 7010441518`}</li>
              <li>{`Address: No 8, Selva Nagar, Eetti Theru, Mettuppatti, Pudukkottai, Tamil Nadu, India-622303`}</li>
            </ul>
          </Section>

          <Section title="33. Legal Requests">
            <p>{`Uniscope may respond to lawful notices, court orders, government directions, competent-authority requests, and valid rights complaints. Where legally required, information may be preserved or disclosed to competent authorities. Nothing prevents Users from exercising rights available under law.`}</p>
          </Section>

          <Section title="34. Changes to Terms">
            <p>{`Uniscope may update these Terms to reflect Platform, business, security, legal, or regulatory changes. Material changes will be communicated by reasonable means where required. Continued use after the effective date constitutes acceptance to the extent permitted by law.`}</p>
          </Section>

          <Section title="35. Electronic Communications">
            <p>{`35.1 By using Uniscope, Users agree to receive electronic communications necessary for the operation and administration of their account, including account activity, security alerts, bookings, Sessions, transactions, service updates, support communications, and legal or policy notices.`}</p>
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
