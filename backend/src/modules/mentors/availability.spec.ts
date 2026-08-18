import { AVAILABILITY_TTL_HOURS, isCallAvailable } from './availability';

// TEST_MATRIX.md MENTOR-002 — availability auto-expires after TTL. Every
// read path (mentor list, mentor detail, the booking gate, the mentor's own
// profile switch) goes through this one function, so testing it here covers
// all of them at once.
describe('isCallAvailable (MENTOR-002)', () => {
  it('is false when the mentor never opted in', () => {
    expect(
      isCallAvailable({ isMentorAvailable: false, availabilitySetAt: new Date() }),
    ).toBe(false);
  });

  it('is false when opted in but availabilitySetAt is null (never switched on)', () => {
    expect(
      isCallAvailable({ isMentorAvailable: true, availabilitySetAt: null }),
    ).toBe(false);
  });

  it('is true just inside the TTL window', () => {
    const justInside = new Date(
      Date.now() - AVAILABILITY_TTL_HOURS * 60 * 60 * 1000 + 60_000,
    );
    expect(
      isCallAvailable({ isMentorAvailable: true, availabilitySetAt: justInside }),
    ).toBe(true);
  });

  it('is false once the TTL has elapsed', () => {
    const justOutside = new Date(
      Date.now() - AVAILABILITY_TTL_HOURS * 60 * 60 * 1000 - 60_000,
    );
    expect(
      isCallAvailable({ isMentorAvailable: true, availabilitySetAt: justOutside }),
    ).toBe(false);
  });

  it('is false for a null/undefined profile', () => {
    expect(isCallAvailable(null)).toBe(false);
    expect(isCallAvailable(undefined)).toBe(false);
  });
});
