# SOP 08: Admin-panel operations

**Purpose:** the day-to-day tasks staff do in the admin panel (admin.uniscope.in).
**Who:** admin operators. **When:** day to day.

Log in with your own admin account (login is through NextAuth). Never share a login. What
you can do depends on the permissions an admin gave you (Admins and permissions page).

## 1. Website sign-ups that did not get an account (Account creation page)

When someone signs up on uniscope.in, the backend tries to create their account. If it
fails, the lead is kept and shown here.

1. Open **Leads, Account creation**. The default list shows sign-ups that need attention.
2. Each row shows the **reason** and the **step** where it stopped:
   - `account`: creating the account (or giving an existing one the role) failed.
   - `document`: the account exists but the mentor's college ID was not sent for review.
   - `link`: the account and document exist but the sign-up is not linked to them yet.
3. **Export CSV** to share the list or to work through it. A Slack alert is also posted to the team channel for each new failure (needs `SLACK_WEBHOOK_URL`, see systems-and-access).
4. Resolve each one. `UNKNOWN — HUMAN INPUT REQUIRED`: the agreed recovery steps now that the Retry account button is gone from this page. The earlier recovery plan is in the Notion item "Recover the stuck website leads". Anusuya or Mega to write the steps here once confirmed.
5. Record the outcome for each lead (account created, skipped and why).

## 2. Sending a promotion (Promotions page)

A promotion is a popup message with an optional link and an optional wallet credit. It also
creates a normal notification and a push.

1. Open **Promotions**, write a **title** (up to 120 characters) and an optional **message** (up to 500).
2. Choose the **audience**: everyone, aspirants only, mentors only, or **selected users** (up to 200, picked by search). Admins and banned, inactive or deleted accounts never receive it.
3. Optional **link** (must be `https`) and a **button label**.
4. Optional **credit**: Uniminutes per **aspirant** (up to 1000) or rupees per **mentor** (up to ₹10,000). A credit for a kind of user the audience does not contain is refused. A promotion with a credit can reach at most **5000 people** at once; send bigger ones in groups.
5. Check the **reach preview** and the confirmation screen. **Read the total money it will credit** before you confirm. A typo here is real money.
6. Send **once**. Then open the history to see how many people received it, how many were credited and how many have seen the popup. Click a promotion to see who received it.
7. People see the popup when they open the app (up to 5 at a time, for 30 days after sending).

**Known gap:** if the send shows an **error**, do **not** send it again. First open the history. If the promotion is listed with recipients, it already went out. Sending again can credit the same people twice. A fix is planned (see the Sprint 3 release notes). Ask a developer if unsure.

## 3. Reading the Money page

- Shows money in by platform (iOS, Android, Web), top-ups with CSV export, trends and payers.
- "Real money in" counts Razorpay payments and Apple purchases. It leaves out Apple test (sandbox) purchases, Apple refunds, and developer test credits, which are listed on their own line so the page still adds up to the ledger.
- Platform for older top-ups is worked out from the price paid (an iOS price means iOS).

## 4. Approving specializations and profile entries

When a user types a course or specialization, it is queued for approval. On the specializations page, pick the **existing name from the dropdown** where one fits, so the same thing is not spelled two ways. Only create a new name when none fits.

## 5. Other tasks

`TODO — HUMAN INPUT REQUIRED` (to be written with screenshots by Anusuya or Mega):
- Mentor verification queue: approve and reject, with the reasons to use.
- Support inbox: replying to a support chat, tone and escalation.
- Reports: resolving a report and issuing a manual refund (refunds are Critical: money).
- Banning and unbanning a user.
- Creating an admin and setting permissions.

## Check it worked
After a task, the page shows the new state (for example the lead no longer in the attention list, the promotion in the history with the right counts).

## If it goes wrong
Do not repeat a money action to "fix" it. Note what you did and when, and tell a developer or Kiran.

Last checked: 2026-11-28.
