/**
 * Apple IAP product-id → Uniminutes mapping, parallel to RECHARGE_PACKAGES
 * in create-topup.dto.ts. Product IDs are named by Uniminute count (not
 * rupee price) so they never need renaming if a price tier shifts — see
 * CLAUDE.md's Apple IAP plan for why. Must be created in App Store Connect
 * with these EXACT ids before this is usable; the credited Uniminute count
 * per package matches Razorpay's exactly (10/20/40/60) — only the rupee
 * price charged differs (Apple's price tier is marked up ~30% over the
 * Razorpay price to absorb Apple's commission, see the iOS top-up sheet).
 */
export const APPLE_PRODUCT_PACKAGES: Readonly<Record<string, number>> = {
  'com.uniscope.uniscopeMobile.uniminutes10': 10,
  'com.uniscope.uniscopeMobile.uniminutes20': 20,
  'com.uniscope.uniscopeMobile.uniminutes40': 40,
  'com.uniscope.uniscopeMobile.uniminutes60': 60,
};

export const APPLE_PRODUCT_IDS = Object.keys(APPLE_PRODUCT_PACKAGES);
