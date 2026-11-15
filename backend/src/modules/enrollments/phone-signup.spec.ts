/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access --
 * Mocks collaborators and inspects the arguments they were called with. */
import { ConflictException } from '@nestjs/common';
import type {
  CreateAspirantLeadDto,
  CreateMentorLeadDto,
} from './dto/create-lead.dto';
import { EnrollmentsService } from './enrollments.service';
import { PHONE_TAKEN_MESSAGE } from './phone-signup-rule';

/** `hasAccount`: whether some account (of any role) already owns the number. */
function setup(hasAccount: boolean) {
  const findUnique = jest
    .fn()
    .mockResolvedValue(hasAccount ? { id: 'u1' } : null);
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
    const { svc, findUnique } = setup(false);
    await svc.isPhoneAvailable(PHONE);
    const where = findUnique.mock.calls[0][0].where;
    expect(where.phoneHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(where)).not.toContain('9876543210');
  });

  it('treats "9876543210" and "+91 98765 43210" as the same number', async () => {
    const { svc, findUnique } = setup(false);
    await svc.isPhoneAvailable('9876543210');
    await svc.isPhoneAvailable('+91 98765 43210');
    expect(findUnique.mock.calls[0][0].where.phoneHash).toBe(
      findUnique.mock.calls[1][0].where.phoneHash,
    );
  });

  it('answers yes for a number nobody has used', async () => {
    const { svc } = setup(false);
    await expect(svc.isPhoneAvailable(PHONE)).resolves.toEqual({
      available: true,
    });
  });

  it('answers no for a number that already has an account', async () => {
    const { svc } = setup(true);
    await expect(svc.isPhoneAvailable(PHONE)).resolves.toEqual({
      available: false,
    });
  });

  it('rejects something that is not a valid number', async () => {
    const { svc } = setup(false);
    await expect(svc.isPhoneAvailable('123')).rejects.toThrow(
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
    const { svc, upsertLead } = setup(true);
    const err: unknown = await svc
      .createAspirantLead(aspirantDto)
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect((err as Error).message).toBe(PHONE_TAKEN_MESSAGE);
    expect(upsertLead).not.toHaveBeenCalled();
  });

  it('refuses a mentor sign-up on a number that already has an account — even an aspirant one', async () => {
    const { svc, upsertLead } = setup(true);
    await expect(svc.createMentorLead(mentorDto)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(upsertLead).not.toHaveBeenCalled();
  });

  it('lets a brand-new number sign up as an aspirant', async () => {
    const { svc, upsertLead } = setup(false);
    await svc.createAspirantLead(aspirantDto);
    expect(upsertLead).toHaveBeenCalledTimes(1);
  });

  it('lets a brand-new number sign up as a mentor', async () => {
    const { svc, upsertLead } = setup(false);
    await svc.createMentorLead(mentorDto);
    expect(upsertLead).toHaveBeenCalledTimes(1);
  });
});
