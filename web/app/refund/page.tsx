import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "../../components/SiteNav";

export const metadata: Metadata = {
  title: "Refund and Cancellation Policy — Uniscope",
  description:
    "The rules applicable to UniMinutes purchases, Mentor Session bookings, cancellations, refunds, and payment adjustments on Uniscope.",
};

const EFFECTIVE_DATE = "01/08/2026";
const LAST_UPDATED = "09/08/2026";
const CONTACT_EMAIL = "support@uniscope.in";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10 first:mt-0">
      <h2 className="text-[19px] font-extrabold text-ink">{title}</h2>
      <div className="mt-3 space-y-3 text-[14.5px] leading-relaxed text-slate-600">{children}</div>
    </section>
  );
}

export default function RefundPolicyPage() {
  return (
    <>
      <SiteNav />
      <main className="px-6 py-14">
        <div className="max-w-[720px] mx-auto">
          <p className="text-[12.5px] font-extrabold uppercase tracking-wide text-blue-600">Legal</p>
          <h1 className="mt-2 text-[clamp(26px,4vw,36px)] font-extrabold text-ink text-wrap-balance">
            Packages, Access, Refund &amp; Cancellation Policy
          </h1>
          <p className="mt-2 text-[13.5px] font-semibold text-slate-400">
            Effective date: {EFFECTIVE_DATE} · Last updated: {LAST_UPDATED}
          </p>

          <Section title="About Us">
            <p>
              UNISCOPE is a technology platform owned and operated by AMSEL GOLD (bearing GSTIN: 33CRHPP4257Q1Z3), a
              sole proprietorship concern of PON BUVANESHWARAN, incorporated and validly existing under the laws of
              India, and it&rsquo;s Subsidiary operating under the trade name &ldquo;UNISCOPE&rdquo;, having its
              registered office at No. 8, Selva Nagar, Eetti Theru, Mettuppatti, Pudukkottai, Tamil Nadu, India –
              622303.
            </p>
          </Section>

          <Section title="1. Purpose and Scope">
            <p>
              This Refund and Cancellation Policy (&ldquo;Policy&rdquo;) explains the rules applicable to purchases
              of UniMinutes, Mentor Session bookings, cancellations, refunds, failed transactions, and related
              payment adjustments on the Uniscope Platform.
            </p>
            <p>
              This Policy forms part of the Uniscope Terms and Conditions. If there is a conflict between this
              Policy and the Terms regarding a paid service, this service-specific Policy will apply to the extent
              of that conflict, subject to Applicable Law.
            </p>
            <p>Definitions:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>&ldquo;Aspirant&rdquo; means a student or prospective student booking or using a Mentor Session.</li>
              <li>&ldquo;Mentor&rdquo; means a verified current student or graduate providing a Session through Uniscope.</li>
              <li>&ldquo;Session&rdquo; means a paid interaction booked through the Platform.</li>
              <li>&ldquo;Booking&rdquo; means a confirmed reservation for a Session.</li>
              <li>&ldquo;No-show&rdquo; means failure by a User to attend or join within the applicable waiting period.</li>
              <li>
                &ldquo;Refund&rdquo; means return of all or part of the amount paid by an Aspirant, subject to this
                Policy and Applicable Law.
              </li>
            </ul>
          </Section>

          <Section title="2. UniMinutes and Paid Services">
            <p>2.1 Uniscope uses UniMinutes as Platform credits for booking eligible Mentor calls.</p>
            <p>
              2.2 The available UniMinutes packages, pricing, applicable benefits, and any promotional offers will
              be displayed on the Platform at the time of purchase and will apply to the relevant transaction.
            </p>
            <p>
              2.3 The Platform may change package availability, pricing, promotions, or bonus structures
              prospectively. The price and applicable terms displayed at checkout will govern the relevant purchase.
            </p>
            <p>
              2.4 The current call options are 6, 10, and 20 minutes, requiring 6, 10, and 20 UniMinutes
              respectively. The corresponding Mentor earnings, as displayed by the Platform at the time the Mentor
              accepts the Session, will apply to the completed call, subject to applicable payout, dispute,
              verification, refund, and compliance checks.
            </p>
          </Section>

          <Section title="3. UniMinutes Purchase and Refunds">
            <p>
              3.1 UniMinutes are Platform credits intended for eligible Mentor Sessions. They are not cash, a bank
              balance, or a general-purpose stored-value instrument.
            </p>
            <p>
              3.2 A UniMinutes purchase is generally non-refundable once any UniMinutes from that purchase have been
              used, except where a refund is required by Applicable Law or approved under this Policy.
            </p>
            <p>
              3.3 A User may request a refund for a completely unused UniMinutes purchase within seven (7) days of
              the transaction. Approved refunds will normally be returned to the original payment method, subject to
              Applicable Law and payment-provider procedures.
            </p>
            <p>
              3.4 UniMinutes will be deducted from the Aspirant&rsquo;s balance only when the Mentor accepts the
              Aspirant&rsquo;s call request. The number of UniMinutes deducted will correspond to the selected call
              duration. For example, acceptance of a 6-minute call will result in the deduction of 6 UniMinutes.
            </p>
            <p>
              3.5 If a call is interrupted or materially affected due to an unforeseen network or technical
              connectivity issue, the Aspirant may raise a request with Uniscope. Uniscope may review the
              circumstances and relevant Session information before determining whether the issue qualifies for a
              remedy.
            </p>
            <p>
              3.6 Where Uniscope determines that the issue was caused by an unforeseen network or technical problem,
              Uniscope may provide the Aspirant with a free replacement call of the affected duration at no
              additional UniMinutes cost.
            </p>
            <p>
              3.7 A replacement call provided under this Policy is a service remedy and does not constitute a cash
              refund or automatic restoration of the UniMinutes deducted for the original call.
            </p>
            <p>
              3.8 Promotional, bonus, or complimentary UniMinutes may have separate conditions and, unless expressly
              stated otherwise, are not refundable or transferable.
            </p>
            <p>3.9 UniMinutes cannot be sold, transferred, or exchanged for cash unless Uniscope expressly enables such functionality.</p>
          </Section>

          <Section title="4. Cancellation and Rescheduling of a Mentor Call">
            <p>
              4.1 Aspirants may cancel a confirmed Mentor Call through the Platform, where the cancellation option
              is available. No UniMinutes will be deducted merely because a call is requested, accepted, confirmed,
              or scheduled. UniMinutes will be deducted only when the scheduled call time begins and the Session is
              initiated or the Mentor begins waiting for the Aspirant.
            </p>
            <p>
              <span className="font-bold text-ink">Until before the scheduled start time:</span> The Aspirant may
              cancel the Session without any charge. No UniMinutes will be deducted.
            </p>
            <p>
              <span className="font-bold text-ink">At or after the scheduled start time:</span> If the Aspirant
              cancels, fails to attend, or does not join the call, the Mentor may remain available and wait for the
              applicable grace period. UniMinutes may be deducted only for the applicable grace period, which shall
              be 50% of the booked Session duration. No additional or penalty charges will be imposed.
            </p>
            <p>The applicable grace periods are as follows:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>6-minute Session: up to 3 minutes</li>
              <li>10-minute Session: up to 5 minutes</li>
              <li>20-minute Session: up to 10 minutes</li>
            </ul>
            <p>
              4.2 An Aspirant may reschedule a confirmed Mentor Call at any time before the scheduled start time,
              subject to the Mentor&rsquo;s availability and the rescheduling options provided by the Platform.
              Rescheduling will generally be permitted without any additional charge, and no UniMinutes will be
              deducted solely because the Session has been rescheduled.
            </p>
            <p>
              4.3 Where a Session is rescheduled, the original booking will be replaced by the newly confirmed date
              and time. The UniMinutes will remain uncharged until the newly scheduled Session begins.
            </p>
            <p>
              4.4 Once the scheduled call time begins, UniMinutes will be deducted based on the actual duration of
              the Session, subject to the maximum duration of the booked Session. The available Session durations
              on the Platform are 6 minutes, 10 minutes, and 20 minutes.
            </p>
            <p>
              4.5 If a Mentor cancels a confirmed call, becomes unavailable, or fails to attend the scheduled
              Session, the Aspirant will not be charged for the affected Session. If any UniMinutes have already
              been deducted because the scheduled time had commenced, the affected UniMinutes will normally be
              returned to the Aspirant&rsquo;s Uniscope account. Where appropriate, the Platform may also provide
              the option to reschedule the Session.
            </p>
            <p>
              4.6 If the Aspirant fails to attend the scheduled call or does not join within the applicable grace
              period, the Session may be treated as a no-show. In such circumstances, UniMinutes may be deducted
              only for the applicable grace period, being 50% of the booked Session duration, as specified in Clause
              4.1. The Mentor&rsquo;s compensation, where applicable, will be determined in accordance with the
              Platform&rsquo;s Mentor payment rules.
            </p>
            <p>
              4.7 If a Session cannot reasonably proceed because of an unforeseen, unavoidable, or uncontrollable
              circumstance beyond the reasonable control of the Aspirant, Mentor, or Platform, Uniscope may, at its
              discretion, restore any affected UniMinutes, permit rescheduling, or provide another appropriate
              resolution, subject to Applicable Law.
            </p>
            <p>
              4.8 Repeated cancellations, excessive rescheduling, repeated no-shows, fraudulent refund claims,
              manipulation of the booking system, or other misuse of the cancellation or rescheduling mechanism may
              result in account restrictions, suspension, or other action in accordance with the Terms and
              Community Guidelines.
            </p>
            <p>4.9 Nothing in this Policy limits any rights or remedies available to an Aspirant or Mentor under Applicable Law.</p>
          </Section>

          <Section title="5. Mentor No-Show">
            <p>
              5.1 If a Mentor fails to attend a confirmed call, the Aspirant should report the issue through the
              Platform as soon as reasonably practicable.
            </p>
            <p>
              5.2 After reviewing the booking and attendance information, Uniscope will normally restore any
              UniMinutes that may have been deducted in connection with the affected call. The Aspirant will not be
              charged for a Session where the Mentor fails to attend or is unavailable to conduct the Session.
            </p>
            <p>
              5.3 The Mentor or Aspirant may request to reschedule a confirmed call through the Platform at any time
              before the scheduled call time, subject to the availability of both the Mentor and Aspirant and the
              time slots available through the Platform.
            </p>
            <p>
              5.4 Where both parties agree to a new available time through the Platform, the Session may be
              rescheduled without requiring a new payment or additional UniMinutes, subject to the applicable
              Platform rules.
            </p>
            <p>
              5.5 If a Mentor cancels, fails to attend, or becomes unavailable before or at the scheduled time, the
              Aspirant may be offered the option to reschedule the Session or receive restoration of any UniMinutes
              deducted, as applicable.
            </p>
            <p>
              5.6 Repeated Mentor no-shows may result in investigation, restriction of bookings, suspension,
              revocation of verification, payout adjustment, or other appropriate action in accordance with the
              Terms and Community Guidelines.
            </p>
          </Section>

          <Section title="6. Aspirant No-Show">
            <p>
              6.1 If an Aspirant fails to join a scheduled Mentor Call without cancelling or rescheduling the
              Session within the applicable cancellation or rescheduling period, the Session may be treated as an
              Aspirant no-show.
            </p>
            <p>
              6.2 Following the scheduled start time, the Mentor may be required to remain available and wait for
              the Aspirant for the applicable grace period, which shall be 50% of the booked Session duration,
              before the Session may be closed as a no-show.
            </p>
            <p>
              6.3 In the event of an Aspirant no-show, UniMinutes may be deducted only for the applicable grace
              period during which the Mentor remained available and waiting for the Aspirant. No additional or
              penalty charges will be imposed.
            </p>
            <p>
              6.4 The Mentor may end the Session after the applicable grace period if the Aspirant has not joined.
              Once the Session is ended, no further UniMinutes will be deducted in respect of that no-show.
            </p>
            <p>
              6.5 The Mentor or Aspirant may request to reschedule a confirmed call through the Platform anytime
              before the scheduled start time, subject to the availability of both the Mentor and Aspirant and the
              time slots available through the Platform.
            </p>
            <p>
              6.6 Where both parties agree to a new available time through the Platform, the Session may be
              rescheduled without requiring a new payment or additional UniMinutes, subject to the applicable
              Platform rules.
            </p>
            <p>
              6.7 If the Aspirant joins the Session after the Mentor has already ended the Session following the
              applicable grace period, the Session will not automatically restart. The parties may request a new
              Session or reschedule the call, subject to the Platform&rsquo;s applicable rules and availability.
            </p>
            <p>
              6.8 Repeated no-shows, repeated late cancellations, excessive rescheduling, or other misuse of the
              call-booking system may result in account restrictions, suspension, or other action in accordance
              with the Terms and Community Guidelines.
            </p>
          </Section>

          <Section title="7. Technical Failure and Interrupted Calls">
            <p>
              7.1 If a call cannot start because of a verified Uniscope-side technical failure, Uniscope will
              normally restore the UniMinutes allocated to the affected call or provide another appropriate remedy.
            </p>
            <p>
              7.2 If a call is interrupted because of a technical problem affecting the Aspirant or Mentor, Uniscope
              may review available technical and Session information before deciding whether to restore affected or
              unused UniMinutes.
            </p>
            <p>7.3 If a Session was substantially completed before an interruption, Uniscope may consider the service successfully delivered.</p>
            <p>7.4 Technical problems should be reported promptly with sufficient information for investigation.</p>
          </Section>

          <Section title="8. Call Duration and Early Termination">
            <p>
              8.1 Users select the available call duration before booking. The applicable UniMinutes are reserved
              or deducted according to the selected duration and the information shown at checkout.
            </p>
            <p>
              8.2 If a Mentor ends a Session materially earlier than the booked duration without reasonable
              justification, Uniscope may review the Session and, where appropriate, restore the unused portion of
              UniMinutes.
            </p>
            <p>
              8.3 If an Aspirant voluntarily ends a Session early after the Mentor has commenced providing the
              booked service, a refund or restoration of the unused portion is not guaranteed.
            </p>
            <p>
              8.4 Dissatisfaction solely with a Mentor&rsquo;s opinion, experience, communication style, or guidance
              does not automatically qualify for a refund. Uniscope may consider a refund where there is a material
              service failure, policy violation, or other valid ground.
            </p>
          </Section>

          <Section title="9. Misconduct and Policy Violations">
            <p>
              9.1 No refund is guaranteed where a User&rsquo;s own misconduct, abuse, fraud, payment manipulation,
              or other policy violation caused the cancellation, suspension, or termination of a Session.
            </p>
            <p>
              9.2 Where a Session is cancelled or interrupted because of serious Mentor misconduct or a verified
              Platform-policy violation, Uniscope may restore the Aspirant&rsquo;s affected UniMinutes and may take
              action against the Mentor.
            </p>
            <p>
              9.3 Where a refund relates to suspected fraud, chargeback abuse, duplicate accounts, payment
              manipulation, or other misuse, Uniscope may temporarily hold the relevant amount or credits while
              investigating, subject to Applicable Law.
            </p>
          </Section>

          <Section title="10. Duplicate, Failed, or Unauthorised Payments">
            <p>
              10.1 If a User is charged more than once for the same purchase or Session due to a confirmed duplicate
              transaction, Uniscope will normally refund the duplicate amount to the original payment method.
            </p>
            <p>
              10.2 If a User&rsquo;s account or bank is debited but the UniMinutes are not credited because a
              transaction failed or was not completed, the User should contact support with the transaction
              details. Uniscope will investigate and, where appropriate, credit the UniMinutes or process a refund.
            </p>
            <p>
              10.3 Users should promptly report transactions they believe were unauthorised. Uniscope may work with
              the relevant payment provider to investigate such claims.
            </p>
          </Section>

          <Section title="11. Refund Method and Processing">
            <p>
              11.1 Approved monetary refunds will normally be processed to the original payment method used for the
              transaction, unless another method is required or permitted by Applicable Law.
            </p>
            <p>
              11.2 The time taken for a refund to appear may depend on the payment gateway, bank, card issuer, UPI
              provider, or other payment service provider.
            </p>
            <p>
              11.3 Uniscope may request reasonable transaction or account verification before processing a refund
              to prevent fraud and ensure the refund reaches the correct User.
            </p>
            <p>
              11.4 Uniscope is not responsible for delays caused solely by a third-party payment provider or
              financial institution, but will take reasonable steps to assist with the refund where appropriate.
            </p>
          </Section>

          <Section title="12. Mentor Payouts and Reversals">
            <p>
              12.1 Under the current UniMinutes model, the Platform displays Mentor earnings of ₹60 for a 6-minute
              call, ₹100 for a 10-minute call, and ₹200 for a 20-minute call.
            </p>
            <p>
              12.2 Mentor earnings are normally credited after successful completion of the Session, subject to
              payment-provider processing, verification, fraud checks, disputes, refunds, chargebacks, and other
              applicable controls.
            </p>
            <p>
              12.3 Where a Session is refunded because of a Mentor no-show, material service failure, verified
              misconduct, or another valid reason, Uniscope may reverse, adjust, or withhold the corresponding
              Mentor payout to the extent permitted by Applicable Law.
            </p>
            <p>
              12.4 Uniscope may delay or withhold payouts where reasonably necessary for fraud prevention, dispute
              resolution, chargeback handling, incomplete verification, legal compliance, or payment-provider
              requirements.
            </p>
          </Section>

          <Section title="13. How to Request a Refund or Report a Cancellation Issue">
            <p>Users should contact Uniscope through the published support channel as soon as possible and provide:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Registered name and account details.</li>
              <li>Transaction ID or payment reference, where available.</li>
              <li>Date and time of the purchase or Session.</li>
              <li>Mentor name or display name, where relevant.</li>
              <li>Booked Session duration, where relevant.</li>
              <li>A brief description and supporting evidence of the issue.</li>
            </ul>
            <p>
              Email with relevant documents at:{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-600 font-bold hover:underline">
                {CONTACT_EMAIL}
              </a>
            </p>
          </Section>

          <Section title="14. Refund Exclusions">
            <p>Except where required by Applicable Law or otherwise approved under this Policy, refunds will generally not be available for:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>UniMinutes already used for completed Sessions.</li>
              <li>Aspirant no-shows.</li>
              <li>Dissatisfaction based solely on a Mentor&rsquo;s personal opinion, experience, or guidance.</li>
              <li>Promotional or complimentary UniMinutes with no cash value.</li>
              <li>Losses caused by a User voluntarily sharing payment credentials or account access with another person.</li>
              <li>Transactions arising from fraud, misuse, or violation of the Terms or Platform policies.</li>
            </ul>
          </Section>

          <Section title="15. Consumer and Statutory Rights">
            <p>
              Nothing in this Policy is intended to exclude, restrict, or waive any statutory, consumer, or other
              legal right or remedy that cannot lawfully be excluded or limited. Where Applicable Law provides a
              refund, cancellation right, remedy, or consumer protection that is more favourable to the User than
              this Policy, the applicable legal requirement will prevail to the extent of the inconsistency.
            </p>
          </Section>

          <Section title="16. Changes to this Policy">
            <p>
              Uniscope may update this Policy to reflect changes to UniMinutes, pricing, Platform features, payment
              arrangements, business practices, or Applicable Law. The updated version will state its effective or
              last-updated date.
            </p>
          </Section>

          <Section title="17. Contact">
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

          <Section title="18. Governing Law">
            <p>
              This Policy is governed by the laws of India and should be read together with the Uniscope Terms and
              Conditions. Subject to mandatory consumer and statutory jurisdiction, disputes shall be subject to the
              courts/tribunals having jurisdiction over Pudukkottai, Tamil Nadu, India.
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
