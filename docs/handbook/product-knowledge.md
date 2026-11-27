# Product knowledge

What Uniscope is, who uses it, and the rules that must not be broken. Sources: the code,
`ai/PROJECT.md` (Aug 2026), the "Business model decisions" in `CLAUDE.md`, and the
releases shipped up to Web/Admin Sprint 3 (26 Nov 2026). Where those disagreed, the newer
code or release won.

## The product in one page

- **Thesis:** the best people to help you choose a college are the people already studying there.
- **Streams:** all academic streams (Medical, Dental, Engineering, Arts & Humanities,
  Commerce & Business, Law, Design, Others). It started medical and dental only.
- **What aspirants can do:** browse mentors and colleges, chat with a mentor, book a paid
  audio call, top up their wallet, write reviews.
- **What mentors do:** get verified, accept chats and call requests, take calls, earn per
  call minute, request payouts.
- **What staff do (admin panel):** verify mentors, approve profile entries, handle reports
  and support chats, send promotions, watch money and sign-ups.

## Roles

| Role | Meaning |
|---|---|
| `ASPIRANT` | Prospective student. Spends Uniminutes on calls. |
| `MENTOR` | Verified current student or alumnus. Earns in rupees. A mentor cannot top up a wallet (UNI-64). |
| `ADMIN` | Staff. Uses the admin panel, not the mobile app. Each admin can have their own permissions. |

## Main journeys

**Aspirant:** welcome, phone OTP login, pick role, onboarding wizard, home. Then browse
mentors or colleges, open a mentor, start a chat (opens at once, no accept step), or
request a call: choose a slot, the wallet balance is checked and a **hold** is placed,
the mentor accepts, both join, the call runs. Top up when the balance is short.

**Mentor:** login, pick role, onboarding wizard (real name, a self-chosen alias, college
details), then identity verification (college ID upload). After approval: switch on
"Accepting call bookings", handle requests, take calls, request a payout.

**Website visitor:** the website at uniscope.in captures sign-ups as **leads**. The
backend then tries to create an account from the lead. When that fails, the lead appears on
the admin **Account creation** page (see SOP 08).

## Business rules that are locked in

Do not change these without Dheepan's explicit decision. Several were reversed once already.

1. **Currency is the Uniminute.** 1 Uniminute = 1 minute of call time = 1000 minor units = ₹10.
   Money is stored as **integer minor units, never floats**.
2. **Aspirants see Uniminutes, not rupees**, except on the top-up screen. Mentors see
   rupees (earnings, payouts), because they withdraw to a bank.
3. **Top-up packages are fixed.** Android and website prices: ₹250, ₹400, ₹750, ₹1000 give
   10, 20, 40, 60 Uniminutes. The iOS prices are 30% higher (₹325, ₹520, ₹975, ₹1300) for
   the same credit. Any other amount is rejected. The margin is never shown as a line item
   and never taken again at billing.
4. **Where people can top up:** iOS through Apple In-App Purchase, Android through Razorpay
   (the Android app currently tells users to recharge on the website instead, UNI-66), and
   the website through Razorpay.
5. **Calls are fixed prepaid slots: 6, 10 or 20 minutes.** Flat mentor rate of ₹10 per
   minute. There is no per-mentor price. A hold is placed at booking; billing happens only
   when **both** sides report they joined.
6. **No free calls.** Chat is free, but **never advertise that chat is free** and never
   write "Free chat" on a button or chip.
7. **Mentor-dropped calls** still bill the aspirant. An admin reviews the report and can
   issue a manual refund. There is no automatic refund.
8. **Scheduled calls:** the aspirant suggests up to two times, the mentor confirms a
   30-minute slot when accepting, and double-booking is refused. An unjoined call resolves
   itself as a no-show after half the slot has passed since the accept.
9. **Mentor availability is stated intent, not presence.** The switch "Accepting call
   bookings" only controls call booking. Never show an "online" dot or imply live presence.
10. **No dating-app copy.** Use "recommend", "connect with", "find". Never "match",
    "matching", "swipe" or "compatibility".
11. **One account per phone number.** A number can only ever have one account (an
    aspirant can later become a mentor). Phone numbers are stored hashed, never plain.
12. **Aliases:** a mentor's alias is their display name, checked live for availability
    (case-insensitive). The real name is encrypted and never returned by the API.
13. **404, not 403,** for anything a user is not a party to, so we do not reveal what exists.
14. **Every ledger write has an idempotency key**, so a retry can never double-apply.
    The ledger is append-only: rows are never edited.

## The parts

| Part | Where | Stack | Notes |
|---|---|---|---|
| Android and iOS apps | `mobile_flutter/` | Flutter, Riverpod, go_router, Dio | Android app id `in.uniscope.app`. Users only get changes in a new store build. |
| Backend API | `backend/` | NestJS, Prisma 7, PostgreSQL on Supabase | Prefix `/api/v1`. Health check at `/health`. |
| Admin panel | `admin/` | Next.js | admin.uniscope.in. Login through NextAuth. Not linked from the app. |
| Website | `web/` | Next.js | uniscope.in. Its own branches. |

Backend modules: users, mentors, universities, university-reviews, sessions, chat, agora,
wallet, payouts, reviews, verification, reports, blocks, notifications, enrollments,
money, promotions, profile-options, data-import, and more. See `ai/ARCHITECTURE.md`.

## Admin panel: what each page is for

| Page | What it does |
|---|---|
| Overview | Headline numbers with date ranges (including the last 24 hours). |
| Users | Search and filter users, ban, see a user's profile including their mobile number. |
| Universities | The college list (filter by course), and a page per college listing its mentors and students. |
| Verification | Queue of mentor ID submissions with document previews. Approve or reject. |
| Specializations | Approve what users typed for course and specialization. Pick an **existing name from a dropdown** to avoid duplicate spellings (UNI-72). |
| Leads and **Account creation** | Website sign-ups. Account creation lists sign-ups that never got an account, with the reason and the step where it stopped, and a CSV export. A Slack alert fires on each new failure. |
| Support | Inbox of support chats. On phones, opening a chat shows only that chat. |
| Reports | Reports against users or sessions. Resolve, optionally refund. |
| **Money** | Money in by platform (iOS, Android, Web), top-ups with CSV export, trends and payers. Apple test purchases and refunds are excluded. |
| **Promotions** | Send a popup message with an optional link and optional wallet credit. See SOP 08. |
| Admins and permissions | Create an admin and set what each admin may do. |

## Website

Home page and sign-up form, a Download page (Play and App Store links), a wallet page where
aspirants buy Uniminutes through Razorpay (mentors get a warning that they cannot top up),
and legal pages. The Android app points users here to recharge.

## Status and what is not built

Built and live: auth, onboarding, discovery, sessions, chat, Agora calls, wallet and
ledger, Razorpay and Apple purchases, payouts, verification, reports, notifications,
admin panel, website. See `CLAUDE.md` ("What's NOT built yet") for the open list. Known
open points as of 28 Nov 2026:

- Sending a promotion **with a credit** has a retry gap: if the send errors halfway,
  sending again can credit people twice. A fix is planned. See SOP 08.
- Staging shares the production database (see systems-and-access).
- Two-device audio calling: `ai/PROJECT.md` says it had not been verified end to end on
  real hardware as of Aug 2026. `UNKNOWN — HUMAN INPUT REQUIRED` for the current state.
