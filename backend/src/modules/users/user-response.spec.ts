import { User, UserProfile } from '@prisma/client';
import { toPublicUser } from './user-response';

// TEST_MATRIX.md AUTH-007 — no phone number (or other identity secret) in
// any response. toPublicUser is the allowlist boundary GET /users/me and
// friends serialize through, so asserting the *shape* it returns never
// contains these keys covers every caller at once.
describe('toPublicUser (AUTH-007)', () => {
  const baseUser: User = {
    id: 'u1',
    phoneHash: 'super-secret-phone-hash',
    displayName: 'Test User',
    role: 'ASPIRANT',
    verificationStatus: 'VERIFIED',
    isActive: true,
    isBanned: false,
    refreshTokenHash: 'super-secret-refresh-hash',
    lastActiveAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    deletedAt: null,
  };

  const baseProfile = {
    id: 'p1',
    userId: 'u1',
    realNameEncrypted: 'super-secret-encrypted-real-name',
    universityId: null,
    graduationYear: null,
    yearOfStudy: null,
    specialty: null,
    bio: null,
    avatarKey: null,
    gender: null,
    state: null,
    city: null,
    qualification: null,
    stream: null,
    dateOfBirth: null,
    courseInterested: null,
    preferredLanguage: null,
    preferredMentorshipTiming: null,
    goals: [],
    isMentorAvailable: false,
    availabilitySetAt: null,
    languages: [],
    availableDays: [],
    pricePerMinuteMinor: 0,
    freeChatsRemaining: 2,
    freeCallSecondsRemaining: 600,
  } as unknown as UserProfile;

  it('never includes phoneHash, refreshTokenHash, or realNameEncrypted — with a profile loaded', () => {
    const response = toPublicUser({ ...baseUser, profile: baseProfile });
    const json = JSON.stringify(response);

    expect(json).not.toContain('phoneHash');
    expect(json).not.toContain('super-secret-phone-hash');
    expect(json).not.toContain('refreshTokenHash');
    expect(json).not.toContain('super-secret-refresh-hash');
    expect(json).not.toContain('realNameEncrypted');
    expect(json).not.toContain('super-secret-encrypted-real-name');
  });

  it('never includes them without a profile loaded either', () => {
    const response = toPublicUser({ ...baseUser, profile: undefined });
    const json = JSON.stringify(response);

    expect(json).not.toContain('phoneHash');
    expect(json).not.toContain('super-secret-phone-hash');
    expect(json).not.toContain('refreshTokenHash');
  });
});
