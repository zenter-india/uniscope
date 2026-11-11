import { toAdminListUser } from './user-response';

const baseUser = {
  id: 'u1',
  phoneHash: 'super-secret-phone-hash',
  phoneEncrypted: 'iv:tag:ct',
  displayName: 'Steady Raven #2798',
  uniqueId: 'M11260000001',
  role: 'MENTOR',
  verificationStatus: 'VERIFIED',
  isActive: true,
  isBanned: false,
  refreshTokenHash: 'secret-refresh',
  lastActiveAt: null,
  createdAt: new Date('2026-11-01'),
  updatedAt: new Date('2026-11-02'),
  deletedAt: null,
};

describe('toAdminListUser — the Users list row', () => {
  const row = (profile: unknown) =>
    toAdminListUser({ ...baseUser, profile } as never);

  it("carries the person's own specialization, not their UG/PG level", () => {
    expect(row({ specialization: 'Community Medicine' }).specialization).toBe(
      'Community Medicine',
    );
  });

  it('is null when there is none (a student, an MBBS mentor, no profile yet)', () => {
    expect(row({ specialization: null }).specialization).toBeNull();
    expect(row({ specialization: '   ' }).specialization).toBeNull();
    expect(row(null).specialization).toBeNull();
    expect(row(undefined).specialization).toBeNull();
  });

  it('keeps the usual list fields', () => {
    expect(row({ specialization: 'Anatomy' })).toMatchObject({
      id: 'u1',
      displayName: 'Steady Raven #2798',
      role: 'MENTOR',
      verificationStatus: 'VERIFIED',
      isBanned: false,
    });
  });

  it('never leaks the secrets or any other profile field into the list', () => {
    const json = JSON.stringify(
      row({
        specialization: 'Anatomy',
        upiIdEncrypted: 'x',
        bio: 'private bio',
      }),
    );
    for (const secret of [
      'phoneHash',
      'phoneEncrypted',
      'refreshTokenHash',
      'upiId',
      'private bio',
      'bio',
    ]) {
      expect(json).not.toContain(secret);
    }
  });
});
