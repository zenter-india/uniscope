import { isCallAvailable } from './availability';

describe('isCallAvailable (MENTOR-002)', () => {
  it('is false when the mentor never opted in', () => {
    expect(isCallAvailable({ isMentorAvailable: false })).toBe(false);
  });

  it('stays true however long ago it was switched on (no auto-expiry)', () => {
    const longAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    expect(
      isCallAvailable({ isMentorAvailable: true, availabilitySetAt: longAgo }),
    ).toBe(true);
    expect(isCallAvailable({ isMentorAvailable: true, availabilitySetAt: null })).toBe(true);
  });

  it('is false for a null/undefined profile', () => {
    expect(isCallAvailable(null)).toBe(false);
    expect(isCallAvailable(undefined)).toBe(false);
  });
});
