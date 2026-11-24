import { Prisma } from '@prisma/client';
import { IOS_PRICE_TIERS_MINOR } from '../wallet/topup-platform.js';

/**
 * What the customer paid for a Razorpay top-up, in paise, read from the audit
 * note the credit writes ("Razorpay order … — paid 25000 minor, credited 10
 * Uniminutes"). NULL for an Apple purchase — see APPLE_PAID_MINOR_SQL.
 * Expects the ledger entry to be aliased `le`.
 */
export const PAID_MINOR_SQL = Prisma.sql`NULLIF(substring(le.note from 'paid ([0-9]+) minor'), '')::int`;

/**
 * What the customer paid for an Apple purchase, in paise. Apple sends the price
 * with every purchase and we keep the whole message in
 * apple_transactions.raw_payload; the price is in thousandths of the currency
 * ("325000" is ₹325.00), so paise is that divided by 10. Only rupee purchases
 * are read; anything else is left unknown rather than guessed.
 * Expects the Apple record to be aliased `apl`.
 */
export const APPLE_PAID_MINOR_SQL = Prisma.sql`CASE
    WHEN apl.raw_payload->>'currency' = 'INR'
      AND apl.raw_payload->>'price' ~ '^[0-9]+$'
    THEN round((apl.raw_payload->>'price')::numeric / 10)::int
  END`;

/**
 * Where a TOPUP ledger entry `le` was made: "android", "ios" or "web".
 *
 * New top-ups store it on the row. The ledger is append-only, so older ones
 * are never edited — they are worked out here instead: an Apple purchase is
 * iOS, and a Razorpay payment is iOS when it was paid at an iOS price and
 * Android otherwise (Razorpay was Android-only until the website wallet
 * existed). NULL means it could not be told (an unexpected key format).
 * Keep this in step with razorpayTopupPlatform() in wallet/topup-platform.ts —
 * both read the same IOS_PRICE_TIERS_MINOR.
 */
export const TOPUP_PLATFORM_SQL = Prisma.sql`COALESCE(le.platform, CASE
    WHEN le.idempotency_key LIKE 'apple-iap:%' THEN 'ios'
    WHEN le.idempotency_key LIKE 'razorpay:%'
      AND ${PAID_MINOR_SQL} IN (${Prisma.join(IOS_PRICE_TIERS_MINOR)}) THEN 'ios'
    WHEN le.idempotency_key LIKE 'razorpay:%' THEN 'android'
  END)`;

/**
 * A TOPUP entry `le` that is real money in: it came from a Razorpay payment or
 * an Apple purchase (or is already tagged with a platform), AND it was not
 * made in Apple's test mode ("Sandbox" — App Review and TestFlight purchases
 * credit Uniminutes but move no money) AND Apple did not refund or revoke it.
 * The ledger also holds developer test and manual TOPUP credits (keys like
 * "manual-test-credit:…"); those are not money in either. They are shown on
 * their own line so the page still adds up to the ledger.
 * Expects the Apple record (if any) to be aliased `apl`.
 */
export const IS_REAL_PAYMENT_SQL = Prisma.sql`(
    (le.platform IS NOT NULL
      OR le.idempotency_key LIKE 'apple-iap:%'
      OR le.idempotency_key LIKE 'razorpay:%')
    AND COALESCE(apl.raw_payload->>'environment', 'Production') <> 'Sandbox'
    AND COALESCE(apl.status::text, 'CREDITED') = 'CREDITED')`;

/**
 * Every TOPUP ledger entry with what the Money page needs worked out once, so
 * every query reads it the same way: `platform`, `paid_minor` (rupees, in
 * paise, when known) and `is_payment` (real money in, see above). Use it as
 * `WITH ${TOPUPS_CTE_SQL} SELECT … FROM topups t`.
 */
export const TOPUPS_CTE_SQL = Prisma.sql`topups AS (
    SELECT le.id,
           le.created_at,
           w.user_id,
           le.amount_minor,
           ${TOPUP_PLATFORM_SQL} AS platform,
           COALESCE(${PAID_MINOR_SQL}, ${APPLE_PAID_MINOR_SQL}) AS paid_minor,
           ${IS_REAL_PAYMENT_SQL} AS is_payment
    FROM ledger_entries le
    JOIN wallets w ON w.id = le.wallet_id
    LEFT JOIN apple_transactions apl ON apl.idempotency_key = le.idempotency_key
    WHERE le.type = 'TOPUP'
  )`;
