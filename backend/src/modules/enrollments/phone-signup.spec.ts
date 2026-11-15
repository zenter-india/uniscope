/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, --
 * Mocks collaborators and inspects the arguments they were called with. */
import { ConflictException } from '@nestjs/common';
import { EnrollmentLeadRole, UserRole } from '@prisma/client';
import type {
  CreateAspirantLeadDto,
  CreateMentorLeadDto,
} from './dto/create-lead.dto';
import { EnrollmentsService } from './enrollments.service';
import { PHONE_TAKEN_MESSAGE, phoneSignupAllowed } from './phone-signup-rule';

const { ASPIRANT, MENTOR } = EnrollmentLeadRole;

describe('phoneSignupAllowed', () => {
  it('allows a number that has no account, for either role', () => {
    expect(phoneSignupAllowed(ASPIRANT, null)).toBe(true);
    expect(phoneSignupAllowed(MENTOR, undefined)).toBe(true);
  });

  it('allows an aspirant account to sign up as a mentor (the upgrade)', () => {
    expect(phoneSignupAllowed(MENTOR, UserRole.ASPIRANT)).toBe(true);
  });

  it('refuses aspirant again', () => {
    expect(phoneSignupAllowed(ASPIRANT, UserRole.ASPIRANT)).toBe(false);
  });

  it('refuses mentor again', () => {
    expect(phoneSignupAllowed(MENTOR, UserRole.MENTOR)).toBe(false);
  });

  it('refuses mentor then aspirant', () => {
    expect(phoneSignupAllowed(ASPIRANT, UserRole.MENTOR)).toBe(false);
  });

  it('refuses a number that belongs to an admin', () => {
    expect(phoneSignupAllowed(ASPIRANT, UserRole.ADMIN)).toBe(false);
    expect(phoneSignupAllowed(MENTOR, UserRole.ADMIN)).toBe(false);
  });
});

function setup(existingRole: UserRole | null) {
  const findUnique = jest
    .fn()
    .mockResolvedValue(existingRole ? { role: existingRole } : null);
  const upsertLead = jest.fn().mockResolvedValue({ id: 'l1' });
  const svc = Object.assign(Object.create(EnrollmentsService.prototype), {
    prisma: { user: { findUnique } },
    upsertLead,
    resolveUniversityId: jest.fn().mockResolvedValue(null),
    provisionAccountFromLead: jest.fn(),
    logger: { error: jest.fn(), warn: jest.fn() },
  }) as EnrollmentsService;
  return { svc, findUnique, upsertLead };
}

const PHONE = '9876543210';

describe('EnrollmentsService.isPhoneAvailable', () => {
  it('looks the number up by its hash, never the plain number', async () => {
    const { svc, findUnique } = setup(null);
    await svc.isPhoneAvailable(ASPIRANT, PHONE);
    const where = findUnique.mock.calls[0][0].where;
    expect(where.phoneHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(where)).not.toContain('9876543210');
  });

  it('treats "9876543210" and "+91 98765 43210" as the same number', async () => {
    const { svc, findUnique } = setup(null);
    await svc.isPhoneAvailable(ASPIRANT, '9876543210');
    await svc.isPhoneAvailable(ASPIRANT, '+91 98765 43210');
    expect(findUnique.mock.calls[0][0].where.phoneHash).toBe(
      findUnique.mock.calls[1][0].where.phoneHash,
    );
  });

  it('answers yes for a new number', async () => {
    const { svc } = setup(null);
    await expect(svc.isPhoneAvailable(ASPIRANT, PHONE)).resolves.toEqual({
      available: true,
    });
  });

  it('answers yes for an aspirant account applying as a mentor', async () => {
    const { svc } = setup(UserRole.ASPIRANT);
    await expect(svc.isPhoneAvailable(MENTOR, PHONE)).resolves.toEqual({
      available: true,
    });
  });

  it('answers no for a number that already has a mentor account', async () => {
    const { svc } = setup(UserRole.MENTOR);
    await expect(svc.isPhoneAvailable(ASPIRANT, PHONE)).resolves.toEqual({
      available: false,
    });
  });

  it('rejects something that is not a valid number', async () => {
    const { svc } = setup(null);
    await expect(svc.isPhoneAvailable(ASPIRANT, '123')).rejects.toThrow(
      'valid Indian mobile number',
    );
  });
});

describe('sign-up submit guard', () => {
  const aspirantDto = {
    phone: PHONE,
    fullName: 'Asha',
  } as CreateAspirantLeadDto;
  const mentorDto = {
    phone: PHONE,
    fullName: 'Ravi',
  } as CreateMentorLeadDto;

  it('refuses an aspirant sign-up on a number that already has an account, saving nothing', async () => {
    const { svc, upsertLead } = setup(UserRole.ASPIRANT);
    const err: unknown = await svc
      .createAspirantLead(aspirantDto)
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect((err as Error).message).toBe(PHONE_TAKEN_MESSAGE);
    expect(upsertLead).not.toHaveBeenCalled();
  });

  it('refuses a mentor sign-up on a number that already has a mentor account', async () => {
    const { svc, upsertLead } = setup(UserRole.MENTOR);
    await expect(svc.createMentorLead(mentorDto)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(upsertLead).not.toHaveBeenCalled();
  });

  it('lets an aspirant account sign up as a mentor', async () => {
    const { svc, upsertLead } = setup(UserRole.ASPIRANT);
    await svc.createMentorLead(mentorDto);
    expect(upsertLead).toHaveBeenCalledTimes(1);
  });

  it('lets a brand-new number sign up as an aspirant', async () => {
    const { svc, upsertLead } = setup(null);
    await svc.createAspirantLead(aspirantDto);
    expect(upsertLead).toHaveBeenCalledTimes(1);
  });
});
