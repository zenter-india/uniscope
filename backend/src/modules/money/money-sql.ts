import { Prisma } from '@prisma/client';
import { IOS_PRICE_TIERS_MINOR } from '../wallet/topup-platform.js';

/**
 * What the customer actually paid for a Razorpay top-up, in paise, read from
 * the audit note the credit writes ("Razorpay order … — paid 25000 minor,
 * credited 10 Uniminutes"). NULL for an Apple purchase: no rupee price is
 * recorded for those (the App Store sets it, and keeps its cut).
 * Expects the ledger entry to be aliased `le`.
 */
export const PAID_MINOR_SQL = Prisma.sql`NULLIF(substring(le.note from 'paid ([0-9]+) minor'), '')::int`;

/**
 * A TOPUP entry `le` that came from a real payment: a Razorpay payment, an
 * Apple purchase, or any entry already tagged with a platform. The ledger also
 * holds test and manual TOPUP credits (idempotency keys like
 * "manual-test-credit:…" or "test-key-1"); those are not money in, so the
 * Money page keeps them out of its totals and its table.
 */
export const IS_PAYMENT_SQL = Prisma.sql`(le.platform IS NOT NULL
    OR le.idempotency_key LIKE 'apple-iap:%'
    OR le.idempotency_key LIKE 'razorpay:%')`;

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
