/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access --
 * Mocks collaborators and inspects the arguments they were called with. */
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { EnrollmentsService } from './enrollments.service';

const baseLead = {
  id: 'l1',
  role: 'MENTOR',
  phone: '+919876543210',
  fullName: 'Rohit Kumar Yadav',
  alias: 'Naveen',
  gender: 'Male',
  state: 'Delhi',
  city: 'New Delhi',
  stream: 'Medical',
  dateOfBirth: null,
  universityId: 'uni1',
  collegeName: 'AIIMS',
  degree: 'MBBS',
  specialization: null,
  yearOfStudy: 3,
  graduationYear: null,
  yearInfoPrivate: false,
  languages: ['Hindi'],
  availableDays: ['Monday'],
  documentType: 'STUDENT_ID',
  documentKey: 'leads/abc.jpg',
  qualification: null,
  courseInterested: null,
  preferredLanguage: null,
  preferredMentorshipTiming: null,
  convertedUserId: null,
};

function setup(lead: Record<string, unknown> | null) {
  const provision = jest.fn().mockResolvedValue(undefined);
  const findById = jest
    .fn()
    .mockResolvedValue({ id: 'l1', status: 'CONVERTED' });
  const svc = Object.assign(Object.create(EnrollmentsService.prototype), {
    prisma: {
      enrollmentLead: { findUnique: jest.fn().mockResolvedValue(lead) },
    },
    logger: { error: jest.fn(), warn: jest.fn() },
    provisionAccountFromLead: provision,
    findById,
  }) as EnrollmentsService;
  return { svc, provision, findById };
}

describe('EnrollmentsService.retryAccount', () => {
  it('404s an unknown lead', async () => {
    const { svc } = setup(null);
    await expect(svc.retryAccount('nope')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('refuses a lead that already has an account, and creates nothing', async () => {
    const { svc, provision } = setup({ ...baseLead, convertedUserId: 'u1' });
    await expect(svc.retryAccount('l1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(provision).not.toHaveBeenCalled();
  });

  it('re-runs account creation for a mentor from what is saved on the lead', async () => {
    const { svc, provision, findById } = setup(baseLead);
    const result = await svc.retryAccount('l1');

    expect(provision).toHaveBeenCalledTimes(1);
    const [role, phone, dto, profile, verification] = provision.mock.calls[0];
    expect(role).toBe('MENTOR');
    expect(phone).toBe('+919876543210');
    expect(dto).toMatchObject({
      fullName: 'Rohit Kumar Yadav',
      alias: 'Naveen',
    });
    // A mentor's degree is stored as the profile's qualification.
    expect(profile).toMatchObject({
      qualification: 'MBBS',
      universityId: 'uni1',
      languages: ['Hindi'],
      yearOfStudy: 3,
    });
    // The saved document and college are reused — nothing is uploaded again.
    expect(verification).toEqual({
      universityId: 'uni1',
      documentType: 'STUDENT_ID',
      documentKey: 'leads/abc.jpg',
    });
    expect(findById).toHaveBeenCalledWith('l1');
    expect(result).toMatchObject({ status: 'CONVERTED' });
  });

  it('uses the alias the admin typed instead of the one on the lead', async () => {
    const { svc, provision } = setup(baseLead);
    await svc.retryAccount('l1', '  Dr Naveen ');
    expect(provision.mock.calls[0][2].alias).toBe('Dr Naveen');
  });

  it('falls back to the lead alias when the admin leaves it blank', async () => {
    const { svc, provision } = setup(baseLead);
    await svc.retryAccount('l1', '   ');
    expect(provision.mock.calls[0][2].alias).toBe('Naveen');
  });

  it('re-runs an aspirant without any verification request', async () => {
    const { svc, provision } = setup({
      ...baseLead,
      role: 'ASPIRANT',
      degree: null,
      qualification: '12th',
      courseInterested: 'MBBS',
      documentKey: null,
      documentType: null,
    });
    await svc.retryAccount('l1');
    const [role, , , profile, verification] = provision.mock.calls[0];
    expect(role).toBe('ASPIRANT');
    expect(profile).toMatchObject({
      qualification: '12th',
      courseInterested: 'MBBS',
    });
    expect(verification).toBeUndefined();
  });

  it('explains a phone that is already linked to another lead', async () => {
    const { svc, provision } = setup(baseLead);
    provision.mockRejectedValue(
      new Error(
        'Unique constraint failed on the constraint: `enrollment_leads_converted_user_id_key`',
      ),
    );
    const err: unknown = await svc.retryAccount('l1').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect((err as Error).message).toContain('another lead');
  });

  it('shows the reason for any other failure, shortened to the last line', async () => {
    const { svc, provision } = setup(baseLead);
    provision.mockRejectedValue(
      new Error(
        'Invalid `prisma.user.create()` invocation:\n\nSomething broke',
      ),
    );
    const err: unknown = await svc.retryAccount('l1').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    expect((err as Error).message).toBe(
      'Could not create the account: Something broke',
    );
  });
});
