/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call --
 * Mocks collaborators and inspects the arguments they were called with. */
import type {
  CreateAspirantLeadDto,
  CreateMentorLeadDto,
} from './dto/create-lead.dto';
import { EnrollmentsService } from './enrollments.service';
import {
  AccountStepError,
  LEAD_ACCOUNT_FAILED,
  LEAD_WITHOUT_ACCOUNT,
  accountExportColumns,
  accountStepOf,
  describeAccountFailure,
  describeAccountStep,
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

describe('an error that remembers its step', () => {
  it('keeps the original message and stack, so nothing that reads them changes', () => {
    const original = new Error(
      'Unique constraint failed on the constraint: `enrollment_leads_converted_user_id_key`',
    );
    const wrapped = new AccountStepError('link', original);

    expect(wrapped).toBeInstanceOf(Error);
    expect(wrapped.message).toBe(original.message);
    expect(wrapped.stack).toBe(original.stack);
    expect(wrapped.original).toBe(original);
    expect(describeAccountFailure(wrapped)).toBe(
      describeAccountFailure(original),
    );
  });

  it('gives the step back, and null for an error that has none', () => {
    expect(
      accountStepOf(new AccountStepError('document', new Error('x'))),
    ).toBe('document');
    expect(accountStepOf(new Error('x'))).toBeNull();
    expect(accountStepOf('plain text')).toBeNull();
    expect(accountStepOf(undefined)).toBeNull();
  });

  it('copes with something that is not an Error', () => {
    const wrapped = new AccountStepError('account', 'plain text');
    expect(wrapped.message).toBe('plain text');
    expect(accountStepOf(wrapped)).toBe('account');
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

  it('saves the step it stopped at next to the reason', async () => {
    const { svc, update, provision } = setup();
    provision.mockRejectedValue(
      new AccountStepError('document', new Error('Something broke')),
    );

    await svc.createAspirantLead(aspirantDto);

    const data = update.mock.calls[0][0].data;
    expect(data.accountFailureStep).toBe('document');
    expect(data.accountFailureReason).toBe('Something broke.');
  });

  it('saves no step when the error did not come from one', async () => {
    const { svc, update, provision } = setup();
    provision.mockRejectedValue(new Error('Something broke'));

    await svc.createAspirantLead(aspirantDto);

    expect(update.mock.calls[0][0].data.accountFailureStep).toBeNull();
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
      accountFailureStep: null,
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
      accountFailureStep: null,
    });
  });
});

describe('the step a real attempt stops at', () => {
  const newMentor = {
    user: { id: 'u1', displayName: 'Ravi', role: 'MENTOR' },
    isNewUser: true,
  };
  const withDocument = {
    universityId: 'uni1',
    documentType: 'COLLEGE_ID',
    documentKey: 'lead-docs/a.jpg',
  };

  function attempt(parts: {
    provision?: jest.Mock;
    transaction?: jest.Mock;
    leadUpdate?: jest.Mock;
  }) {
    const svc = Object.assign(Object.create(EnrollmentsService.prototype), {
      prisma: {
        enrollmentLead: {
          update: parts.leadUpdate ?? jest.fn().mockResolvedValue({}),
        },
        verificationRequest: { create: jest.fn(), count: jest.fn() },
        user: { update: jest.fn() },
        $transaction: parts.transaction ?? jest.fn().mockResolvedValue([]),
      },
      usersService: {
        provisionAccountFromLead:
          parts.provision ?? jest.fn().mockResolvedValue(newMentor),
      },
      notifications: { send: jest.fn().mockResolvedValue(undefined) },
      logger: { error: jest.fn(), warn: jest.fn() },
    }) as EnrollmentsService;
    return (svc as any).provisionAccountFromLead(
      'MENTOR',
      '+919876543210',
      { fullName: 'Ravi' },
      {},
      withDocument,
    ) as Promise<string>;
  }

  async function stepOf(run: Promise<string>) {
    const err: unknown = await run.then(
      () => null,
      (e: unknown) => e,
    );
    return { step: accountStepOf(err), message: (err as Error).message };
  }

  it('is "account" when the account itself could not be created', async () => {
    const result = await stepOf(
      attempt({ provision: jest.fn().mockRejectedValue(new Error('no db')) }),
    );
    expect(result).toEqual({ step: 'account', message: 'no db' });
  });

  it('is "document" when only the college document could not be sent', async () => {
    const result = await stepOf(
      attempt({ transaction: jest.fn().mockRejectedValue(new Error('no db')) }),
    );
    expect(result).toEqual({ step: 'document', message: 'no db' });
  });

  it('is "link" when only linking the sign-up to the account failed', async () => {
    const result = await stepOf(
      attempt({ leadUpdate: jest.fn().mockRejectedValue(new Error('no db')) }),
    );
    expect(result).toEqual({ step: 'link', message: 'no db' });
  });

  it('never says "document" for a sign-up with no document to send', async () => {
    const svc = Object.assign(Object.create(EnrollmentsService.prototype), {
      prisma: {
        enrollmentLead: {
          update: jest.fn().mockRejectedValue(new Error('no db')),
        },
      },
      usersService: {
        provisionAccountFromLead: jest.fn().mockResolvedValue({
          user: { id: 'u1', displayName: 'Asha', role: 'ASPIRANT' },
          isNewUser: true,
        }),
      },
    }) as EnrollmentsService;

    const result = await stepOf(
      (svc as any).provisionAccountFromLead(
        'ASPIRANT',
        '+919876543210',
        { fullName: 'Asha' },
        {},
      ) as Promise<string>,
    );
    expect(result.step).toBe('link');
  });

  it('is cleared along with the reason once the account is linked', async () => {
    const leadUpdate = jest.fn().mockResolvedValue({});
    await expect(attempt({ leadUpdate })).resolves.toBe('u1');
    expect(leadUpdate.mock.calls[0][0].data.accountFailureStep).toBeNull();
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

  it('refreshes the step too, and still reports a clash in plain words', async () => {
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
        .mockRejectedValue(
          new AccountStepError(
            'link',
            new Error(
              'Unique constraint failed on the constraint: `enrollment_leads_converted_user_id_key`',
            ),
          ),
        ),
    }) as EnrollmentsService;

    await expect(svc.retryAccount('lead1')).rejects.toThrow(
      'already has an account that is linked to another lead',
    );
    expect(update.mock.calls[0][0].data.accountFailureStep).toBe('link');
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

describe('the account columns of the CSV export', () => {
  const noAccount = {
    convertedUserId: null,
    status: 'NEW',
    accountFailureStep: null,
    accountFailureReason: null,
    accountFailedAt: null,
  };

  it('names each step in plain words, and nothing for an unknown one', () => {
    expect(describeAccountStep('account')).toBe('Creating the account');
    expect(describeAccountStep('document')).toBe(
      'Sending the college ID for review',
    );
    expect(describeAccountStep('link')).toBe(
      'Linking the account to the sign-up',
    );
    expect(describeAccountStep('something new')).toBe('');
    expect(describeAccountStep(null)).toBe('');
  });

  it('gives the step, reason and time of a failure', () => {
    const failedAt = new Date('2026-11-20T10:00:00.000Z');
    expect(
      accountExportColumns({
        ...noAccount,
        accountFailureStep: 'link',
        accountFailureReason: 'The alias is already in use by another account.',
        accountFailedAt: failedAt,
      }),
    ).toEqual({
      hasAccount: 'No',
      step: 'Linking the account to the sign-up',
      reason: 'The alias is already in use by another account.',
      failedAt: '2026-11-20T10:00:00.000Z',
    });
  });

  it('says "Not recorded" for a sign-up with no account and nothing saved', () => {
    expect(accountExportColumns(noAccount)).toEqual({
      hasAccount: 'No',
      step: 'Not recorded',
      reason: 'Not recorded',
      failedAt: '',
    });
  });

  it('says "Not recorded" for the step alone when only the reason was saved', () => {
    expect(
      accountExportColumns({
        ...noAccount,
        accountFailureReason: 'Something broke.',
      }),
    ).toMatchObject({ step: 'Not recorded', reason: 'Something broke.' });
  });

  it('leaves them empty for a sign-up that has an account', () => {
    expect(
      accountExportColumns({ ...noAccount, convertedUserId: 'u1' }),
    ).toEqual({ hasAccount: 'Yes', step: '', reason: '', failedAt: '' });
  });

  it('leaves them empty for a sign-up rejected on purpose', () => {
    expect(accountExportColumns({ ...noAccount, status: 'REJECTED' })).toEqual({
      hasAccount: 'No',
      step: '',
      reason: '',
      failedAt: '',
    });
  });
});

describe('exporting the sign-ups without an account', () => {
  const row = (over: Record<string, unknown>) => ({
    id: 'l1',
    role: 'MENTOR',
    status: 'NEW',
    fullName: 'Ravi',
    phone: '+919876543210',
    email: null,
    dateOfBirth: null,
    gender: null,
    state: null,
    city: null,
    stream: null,
    qualification: null,
    courseInterested: null,
    preferredLanguage: null,
    preferredMentorshipTiming: null,
    alias: null,
    universityId: null,
    collegeName: null,
    degree: null,
    specialization: null,
    currentStatus: null,
    yearOfStudy: null,
    graduationYear: null,
    yearInfoPrivate: false,
    languages: [],
    availableDays: [],
    documentType: null,
    documentKey: null,
    convertedUserId: null,
    adminNote: null,
    accountFailureReason: null,
    accountFailedAt: null,
    accountFailureStep: null,
    createdAt: new Date('2026-11-19T09:00:00.000Z'),
    updatedAt: new Date('2026-11-19T09:00:00.000Z'),
    university: null,
    ...over,
  });

  function exporting(rows: unknown[]) {
    const findMany = jest.fn().mockResolvedValue(rows);
    const svc = Object.assign(Object.create(EnrollmentsService.prototype), {
      prisma: { enrollmentLead: { findMany } },
    }) as EnrollmentsService;
    return { svc, findMany };
  }

  /** The cells of one CSV line. An empty value is written bare, a text one in
   * quotes; none of the values used here holds a comma. */
  const cells = (line: string) =>
    line.split(',').map((cell) => cell.replace(/^"|"$/g, ''));

  it('asks only for the sign-ups that need attention, or all without an account', async () => {
    const failed = exporting([]);
    await failed.svc.exportCsv({ account: 'failed' } as never);
    expect(failed.findMany.mock.calls[0][0].where).toMatchObject(
      LEAD_ACCOUNT_FAILED,
    );

    const missing = exporting([]);
    await missing.svc.exportCsv({ account: 'missing' } as never);
    expect(missing.findMany.mock.calls[0][0].where).toMatchObject(
      LEAD_WITHOUT_ACCOUNT,
    );
    expect(missing.findMany.mock.calls[0][0].where).not.toHaveProperty(
      'accountFailureReason',
    );
  });

  it('adds the step, reason and time after the columns it always had', async () => {
    const { svc } = exporting([
      row({
        accountFailureStep: 'document',
        accountFailureReason: 'Timed out.',
        accountFailedAt: new Date('2026-11-19T09:00:05.000Z'),
      }),
      row({ id: 'l2', fullName: 'Older one' }),
    ]);

    const [header, failed, older] = (
      await svc.exportCsv({ account: 'missing' } as never)
    ).split('\n');

    const head = cells(header);
    expect(head.slice(-5)).toEqual([
      'Admin note',
      'Has account',
      'Account stopped at',
      'Account problem',
      'Account problem time',
    ]);
    expect(head[0]).toBe('Submitted');
    expect(cells(failed).slice(-4)).toEqual([
      'No',
      'Sending the college ID for review',
      'Timed out.',
      '2026-11-19T09:00:05.000Z',
    ]);
    expect(cells(older).slice(-4)).toEqual([
      'No',
      'Not recorded',
      'Not recorded',
      '',
    ]);
  });
});
