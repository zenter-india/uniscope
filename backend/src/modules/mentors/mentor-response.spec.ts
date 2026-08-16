import { User, UserProfile } from '@prisma/client';
import { toMentorResponse } from './mentor-response.js';

// TEST_MATRIX.md AUTH-007 — no phone number (or other identity secret) in
// any response, applied to the mentor-facing projection specifically:
// mentors are anonymous by product design, so this boundary matters even
// more here than on the self-lookup path in user-response.spec.ts.
describe('toMentorResponse (AUTH-007)', () => {
  const baseUser: User = {
    id: 'm1',
    phoneHash: 'super-secret-phone-hash',
    displayName: 'Anon Mentor',
    role: 'MENTOR',
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
    userId: 'm1',
    realNameEncrypted: 'super-secret-encrypted-real-name',
    universityId: null,
    graduationYear: 3,
    yearOfStudy: 2,
    specialty: null,
    bio: 'Happy to help!',
    avatarKey: null,
    gender: null,
    state: null,
    city: null,
    qualification: null,
    stream: 'Medical',
    dateOfBirth: null,
    courseInterested: null,
    preferredLanguage: null,
    preferredMentorshipTiming: null,
    goals: [],
    isMentorAvailable: false,
    availabilitySetAt: null,
    languages: ['English'],
    availableDays: [],
    pricePerMinuteMinor: 1000,
    freeChatsRemaining: 0,
    freeCallSecondsRemaining: 0,
    university: null,
  } as unknown as UserProfile & { university: null };

  it('never includes phoneHash, refreshTokenHash, or realNameEncrypted', () => {
    const response = toMentorResponse({ ...baseUser, profile: baseProfile });
    const json = JSON.stringify(response);

    expect(json).not.toContain('phoneHash');
    expect(json).not.toContain('super-secret-phone-hash');
    expect(json).not.toContain('refreshTokenHash');
    expect(json).not.toContain('super-secret-refresh-hash');
    expect(json).not.toContain('realNameEncrypted');
    expect(json).not.toContain('super-secret-encrypted-real-name');
  });
});
