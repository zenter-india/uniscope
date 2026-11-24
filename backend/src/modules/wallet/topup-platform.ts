import { RECHARGE_PACKAGES } from './dto/create-topup.dto.js';

/** Where a wallet top-up was made — stored on the TOPUP ledger entry. */
export const TOPUP_PLATFORMS = ['android', 'ios', 'web'] as const;
export type TopupPlatform = (typeof TOPUP_PLATFORMS)[number];

export function isTopupPlatform(value: unknown): value is TopupPlatform {
  return (
    typeof value === 'string' &&
    (TOPUP_PLATFORMS as readonly string[]).includes(value)
  );
}

/**
 * The marked-up iOS prices (the Android price × 1.3, see RECHARGE_PACKAGES).
 * Each package size has two prices; the dearer one is the iOS price. Derived
 * from RECHARGE_PACKAGES so this can never drift from the price list. A size
 * with only one price has no iOS tier.
 */
export const IOS_PRICE_TIERS_MINOR: readonly number[] = (() => {
  const bySize = new Map<number, number[]>();
  for (const [paid, uniminutes] of Object.entries(RECHARGE_PACKAGES)) {
    bySize.set(uniminutes, [...(bySize.get(uniminutes) ?? []), Number(paid)]);
  }
  return [...bySize.values()]
    .filter((prices) => prices.length > 1)
    .map((prices) => Math.max(...prices))
    .sort((a, b) => a - b);
})();

/**
 * The platform of a Razorpay top-up. The app may say where it is running when
 * it asks for the order (the website wallet will say "web"); older app builds
 * say nothing, so then it is worked out from the price paid: an iOS price
 * means iOS, anything else Android (Razorpay was Android-only until the
 * website wallet existed).
 */
export function razorpayTopupPlatform(
  declared: unknown,
  paidMinor: number,
): TopupPlatform {
  if (isTopupPlatform(declared)) return declared;
  return IOS_PRICE_TIERS_MINOR.includes(paidMinor) ? 'ios' : 'android';
}
