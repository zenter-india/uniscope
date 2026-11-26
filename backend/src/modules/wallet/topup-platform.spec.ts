// The price list lives in a DTO file whose decorators need this; Nest loads it
// at app start, a standalone spec has to do it itself.
import 'reflect-metadata';
import {
  IOS_PRICE_TIERS_MINOR,
  isTopupPlatform,
  razorpayTopupPlatform,
} from './topup-platform';

describe('IOS_PRICE_TIERS_MINOR', () => {
  it('is exactly the four marked-up iOS prices, derived from the price list', () => {
    expect(IOS_PRICE_TIERS_MINOR).toEqual([32_500, 52_000, 97_500, 130_000]);
  });
});

describe('isTopupPlatform', () => {
  it('accepts the three platforms and nothing else', () => {
    expect(isTopupPlatform('android')).toBe(true);
    expect(isTopupPlatform('ios')).toBe(true);
    expect(isTopupPlatform('web')).toBe(true);
    expect(isTopupPlatform('Android')).toBe(false);
    expect(isTopupPlatform('')).toBe(false);
    expect(isTopupPlatform(undefined)).toBe(false);
    expect(isTopupPlatform(7)).toBe(false);
  });
});

describe('razorpayTopupPlatform', () => {
  it('uses what the app declared', () => {
    expect(razorpayTopupPlatform('web', 25_000)).toBe('web');
    expect(razorpayTopupPlatform('ios', 25_000)).toBe('ios');
    expect(razorpayTopupPlatform('android', 32_500)).toBe('android');
  });

  it('works it out from an iOS price when nothing was declared', () => {
    for (const paid of [32_500, 52_000, 97_500, 130_000]) {
      expect(razorpayTopupPlatform(undefined, paid)).toBe('ios');
    }
  });

  it('treats an Android price with nothing declared as Android', () => {
    for (const paid of [25_000, 40_000, 75_000, 100_000]) {
      expect(razorpayTopupPlatform(undefined, paid)).toBe('android');
    }
  });

  it('ignores a declared value it does not know', () => {
    expect(razorpayTopupPlatform('windows', 25_000)).toBe('android');
    expect(razorpayTopupPlatform('', 52_000)).toBe('ios');
  });
});
