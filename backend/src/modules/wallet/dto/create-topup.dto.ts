import { Type } from 'class-transformer';
import { IsIn, IsInt } from 'class-validator';

/**
 * The four fixed recharge packages (product decision, 2026-09-06 — replaces
 * the earlier continuous "₹12.50 paid per Uniminute credited" formula that
 * worked for any top-up amount). Keyed by the exact paid amount in minor
 * units (paise). Non-linear: the bigger the package, the more Uniminutes per
 * rupee — the opposite margin shape from the old flat 20%.
 *
 *   ₹250  (25 000 minor)  → 10 Uniminutes
 *   ₹400  (40 000 minor)  → 20 Uniminutes
 *   ₹750  (75 000 minor)  → 40 Uniminutes
 *   ₹1000 (100 000 minor) → 60 Uniminutes
 *
 * This is a CLOSED set — any other amount is rejected, both by this DTO's
 * `@IsIn` and by `WalletService.computeTopupCredit` (defence in depth for
 * the webhook / direct-confirm paths, which read the amount back from
 * Razorpay rather than from this DTO).
 */
export const RECHARGE_PACKAGES: Readonly<Record<number, number>> = {
  25_000: 10,
  40_000: 20,
  75_000: 40,
  100_000: 60,
};

export const RECHARGE_AMOUNTS_MINOR = Object.keys(RECHARGE_PACKAGES).map(Number);

export class CreateTopupDto {
  @Type(() => Number)
  @IsInt()
  @IsIn(RECHARGE_AMOUNTS_MINOR)
  amountMinor!: number;
}
