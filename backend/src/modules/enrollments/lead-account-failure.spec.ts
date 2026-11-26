/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call --
 * Mocks collaborators and inspects the arguments they were called with. */
import type {
  CreateAspirantLeadDto,
  CreateMentorLeadDto,
} from './dto/create-lead.dto';
import { EnrollmentsService } from './enrollments.service';
import {
  LEAD_ACCOUNT_FAILED,
  LEAD_WITHOUT_ACCOUNT,
  describeAccountFailure,
} from './lead-account-failure';

describe('describeAccountFailure', () => {
  it('explains a phone that is already linked to another lead in plain words', () => {
    const reason = describeAccountFailure(
      new Error(
        'Unique constraint failed on the constraint: `enrollment_leads_converted_user_id_key`',
      ),
    );
    expect(reason).toContain('already has an account');
    expect(reason).toContain('another lead');
  });

  it('explains a taken alias', () => {
    const reason = describeAccountFailure(
      new Error(
        'Unique constraint failed on the constraint: `users_display_name_lower_key`',
      ),
    );
    expect(reason).toBe('The alias is already in use by another account.');
  });

  it('explains a phone that already has an account', () => {
    const reason = describeAccountFailure(
      new Error(
        'Unique constraint failed on the constraint: `users_phone_hash_key`',
      ),
    );
    expect(reason).toBe('This phone number already has an account.');
  });

  it('shows only the last line of any other error, never the whole stack', () => {
    const reason = describeAccountFailure(
      new Error(
        'Invalid `prisma.user.create()` invocation:\n\nSomething broke',
      ),
    );
    expect(reason).toBe('Something broke.');
  });

  it('ends an unexpected reason with a full stop so it reads as a sentence', () => {
    expect(describeAccountFailure(new Error('Timed out'))).toBe('Timed out.');
  });

  it('leaves a reason that already ends in punctuation as it is', () => {
    expect(describeAccountFailure(new Error('Something broke!'))).toBe(
      'Something broke!',
    );
    expect(describeAccountFailure(new Error('Is the pool full?'))).toBe(
      'Is the pool full?',
    );
  });

  it('copes with something that is not an Error, and keeps it short', () => {
    expect(describeAccountFailure('plain text')).toBe('plain text.');
    expect(describeAccountFailure(new Error('x'.repeat(2000))).length).toBe(
      201,
    );
    expect(
      describeAccountFailure(new Error('converted_user_id'.repeat(50))).length,
    ).toBeLessThanOrEqual(300);
  });
});

describe('the "no account" rules', () => {
  it('"without an account" means nothing linked and not rejected on purpose', () => {
    expect(LEAD_WITHOUT_ACCOUNT).toEqual({
      convertedUserId: null,
      status: { not: 'REJECTED' },
    });
  });

  it('"failed" is the same, but only where a reason was recorded', () => {
    expect(LEAD_ACCOUNT_FAILED).toEqual({
      convertedUserId: null,
      status: { not: 'REJECTED' },
      accountFailureReason: { not: null },
    });
  });
});

function setup() {
  const update = jest.fn().mockResolvedValue({});
  const provision = jest.fn().mockResolvedValue('user1');
  const svc = Object.assign(Object.create(EnrollmentsService.prototype), {
    prisma: { enrollmentLead: { update } },
    logger: { error: jest.fn(), warn: jest.fn() },
    assertPhoneAvailable: jest.fn().mockResolvedValue(undefined),
    resolveUniversityId: jest.fn().mockResolvedValue(null),
    upsertLead: jest
      .fn()
      .mockResolvedValue({ id: 'lead1', role: 'ASPIRANT', status: 'NEW' }),
    provisionAccountFromLead: provision,
    queueTypedChoices: jest.fn().mockResolvedValue(undefined),
  }) as EnrollmentsService;
  return { svc, update, provision };
}

const aspirantDto = {
  phone: '9876543210',
  fullName: ' Asha ',
} as CreateAspirantLeadDto;
const mentorDto = {
  phone: '9876543210',
  fullName: 'Ravi',
} as CreateMentorLeadDto;

describe('a sign-up whose account could not be created', () => {
  it('saves the reason and time on the lead and still answers the form', async () => {
    const { svc, update, provision } = setup();
    provision.mockRejectedValue(
      new Error(
        'Unique constraint failed on the constraint: `users_display_name_lower_key`',
      ),
    );

    const ack = await svc.createAspirantLead(aspirantDto);

    expect(ack).toMatchObject({ id: 'lead1' });
    expect(update).toHaveBeenCalledTimes(1);
    const arg = update.mock.calls[0][0];
    expect(arg.where).toEqual({ id: 'lead1' });
    expect(arg.data.accountFailureReason).toBe(
      'The alias is already in use by another account.',
    );
    expect(arg.data.accountFailedAt).toBeInstanceOf(Date);
  });

  it('does the same for a mentor', async () => {
    const { svc, update, provision } = setup();
    (svc as any).upsertLead = jest
      .fn()
      .mockResolvedValue({ id: 'lead2', role: 'MENTOR', status: 'NEW' });
    provision.mockRejectedValue(new Error('Something broke'));

    const ack = await svc.createMentorLead(mentorDto);

    expect(ack).toMatchObject({ id: 'lead2' });
    expect(update.mock.calls[0][0].where).toEqual({ id: 'lead2' });
    expect(update.mock.calls[0][0].data.accountFailureReason).toBe(
      'Something broke.',
    );
  });

  it('still answers the form when saving the reason also fails', async () => {
    const { svc, update, provision } = setup();
    provision.mockRejectedValue(new Error('Something broke'));
    update.mockRejectedValue(new Error('db down'));

    await expect(svc.createAspirantLead(aspirantDto)).resolves.toMatchObject({
      id: 'lead1',
    });
  });

  it('records nothing when the account was created', async () => {
    const { svc, update } = setup();

    await svc.createAspirantLead(aspirantDto);
    await svc.createMentorLead(mentorDto);

    expect(update).not.toHaveBeenCalled();
  });

  it('records nothing when only a step after the account failed', async () => {
    const { svc, update } = setup();
    (svc as any).queueTypedChoices = jest
      .fn()
      .mockRejectedValue(new Error('queue down'));

    await svc.createAspirantLead(aspirantDto);
    await svc.createMentorLead(mentorDto);

    expect(update).not.toHaveBeenCalled();
  });
});

describe('clearing an earlier failure', () => {
  it('wipes the reason when the account is created and linked', async () => {
    const update = jest.fn().mockResolvedValue({});
    const svc = Object.assign(Object.create(EnrollmentsService.prototype), {
      prisma: { enrollmentLead: { update } },
      usersService: {
        provisionAccountFromLead: jest.fn().mockResolvedValue({
          user: { id: 'u1', displayName: 'Asha', role: 'ASPIRANT' },
          isNewUser: false,
        }),
      },
    }) as EnrollmentsService;

    await (svc as any).provisionAccountFromLead(
      'ASPIRANT',
      '+919876543210',
      { fullName: 'Asha', alias: 'Asha' },
      {},
    );

    expect(update.mock.calls[0][0].data).toMatchObject({
      convertedUserId: 'u1',
      status: 'CONVERTED',
      accountFailureReason: null,
      accountFailedAt: null,
    });
  });

  it('wipes it when an admin links the lead to an account by hand', async () => {
    const update = jest.fn().mockResolvedValue({
      id: 'lead1',
      role: 'ASPIRANT',
      status: 'CONVERTED',
      documentKey: null,
    });
    const svc = Object.assign(Object.create(EnrollmentsService.prototype), {
      prisma: {
        enrollmentLead: {
          findUnique: jest.fn().mockResolvedValue({ id: 'lead1' }),
          update,
        },
        user: { findUnique: jest.fn().mockResolvedValue({ id: 'u1' }) },
      },
    }) as EnrollmentsService;

    await svc.update('lead1', { convertedUserId: 'u1' });

    expect(update.mock.calls[0][0].data).toMatchObject({
      convertedUserId: 'u1',
      accountFailureReason: null,
      accountFailedAt: null,
    });
  });
});

describe('a failed retry', () => {
  it('refreshes the reason on the lead with the latest attempt', async () => {
    const update = jest.fn().mockResolvedValue({});
    const svc = Object.assign(Object.create(EnrollmentsService.prototype), {
      prisma: {
        enrollmentLead: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'lead1',
            role: 'ASPIRANT',
            phone: '+919876543210',
            fullName: 'Asha',
            alias: 'Asha',
            convertedUserId: null,
            languages: [],
            availableDays: [],
            yearInfoPrivate: false,
          }),
          update,
        },
      },
      logger: { error: jest.fn(), warn: jest.fn() },
      provisionAccountFromLead: jest
        .fn()
        .mockRejectedValue(new Error('Something broke')),
    }) as EnrollmentsService;

    await expect(svc.retryAccount('lead1')).rejects.toThrow(
      'Could not create the account',
    );

    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][0].where).toEqual({ id: 'lead1' });
    expect(update.mock.calls[0][0].data.accountFailureReason).toBe(
      'Something broke.',
    );
  });
});

describe('listing the sign-ups that need attention', () => {
  function listing() {
    const findMany = jest.fn().mockResolvedValue([]);
    const svc = Object.assign(Object.create(EnrollmentsService.prototype), {
      prisma: { enrollmentLead: { findMany } },
    }) as EnrollmentsService;
    return { svc, findMany };
  }

  it('"failed" keeps only leads with no account and a recorded reason', async () => {
    const { svc, findMany } = listing();
    await svc.findAll({ account: 'failed' });
    expect(findMany.mock.calls[0][0].where).toMatchObject({
      convertedUserId: null,
      status: { not: 'REJECTED' },
      accountFailureReason: { not: null },
    });
  });

  it('"missing" keeps every lead with no account, reason or not', async () => {
    const { svc, findMany } = listing();
    await svc.findAll({ account: 'missing' });
    const where = findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({
      convertedUserId: null,
      status: { not: 'REJECTED' },
    });
    expect(where).not.toHaveProperty('accountFailureReason');
  });

  it('a status picked on purpose wins over the "not rejected" default', async () => {
    const { svc, findMany } = listing();
    await svc.findAll({ account: 'failed', status: 'REJECTED' });
    expect(findMany.mock.calls[0][0].where.status).toBe('REJECTED');
  });

  it('applies no account rule when none is asked for', async () => {
    const { svc, findMany } = listing();
    await svc.findAll({});
    const where = findMany.mock.calls[0][0].where;
    expect(where).not.toHaveProperty('convertedUserId');
    expect(where).not.toHaveProperty('accountFailureReason');
  });
});

describe('the counts', () => {
  it('counts failed and missing separately, each with its own rule', async () => {
    const count = jest.fn((args?: { where?: Record<string, unknown> }) => {
      if (args?.where && 'accountFailureReason' in args.where)
        return Promise.resolve(2);
      if (args?.where && 'convertedUserId' in args.where)
        return Promise.resolve(165);
      return Promise.resolve(1441);
    });
    const svc = Object.assign(Object.create(EnrollmentsService.prototype), {
      prisma: {
        enrollmentLead: {
          groupBy: jest.fn().mockResolvedValue([]),
          count,
        },
      },
    }) as EnrollmentsService;

    const stats = await svc.stats();

    expect(stats).toMatchObject({
      total: 1441,
      accountFailed: 2,
      withoutAccount: 165,
    });
  });
});
