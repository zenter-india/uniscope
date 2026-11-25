/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access --
 * Mocks collaborators and inspects the arguments they were called with. */
import type {
  CreateAspirantLeadDto,
  CreateMentorLeadDto,
} from './dto/create-lead.dto';
import { EnrollmentsService } from './enrollments.service';
import { describeAccountFailure } from './lead-account-failure';

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
    expect(reason).toBe('Something broke');
  });

  it('copes with something that is not an Error, and keeps it short', () => {
    expect(describeAccountFailure('plain text')).toBe('plain text');
    expect(describeAccountFailure(new Error('x'.repeat(2000))).length).toBe(
      200,
    );
    expect(
      describeAccountFailure(new Error('converted_user_id'.repeat(50))).length,
    ).toBeLessThanOrEqual(300);
  });
});

function setup() {
  const send = jest.fn().mockResolvedValue(undefined);
  const provision = jest.fn().mockResolvedValue('user1');
  const svc = Object.assign(Object.create(EnrollmentsService.prototype), {
    slack: { send },
    logger: { error: jest.fn(), warn: jest.fn() },
    assertPhoneAvailable: jest.fn().mockResolvedValue(undefined),
    resolveUniversityId: jest.fn().mockResolvedValue(null),
    upsertLead: jest
      .fn()
      .mockResolvedValue({ id: 'lead1', role: 'ASPIRANT', status: 'NEW' }),
    provisionAccountFromLead: provision,
    queueTypedChoices: jest.fn().mockResolvedValue(undefined),
  }) as EnrollmentsService;
  return { svc, send, provision };
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
  it('alerts the team with who and why, and still answers the form', async () => {
    const { svc, send, provision } = setup();
    provision.mockRejectedValue(
      new Error(
        'Unique constraint failed on the constraint: `users_display_name_lower_key`',
      ),
    );

    const ack = await svc.createAspirantLead(aspirantDto);

    expect(ack).toMatchObject({ id: 'lead1' });
    expect(send).toHaveBeenCalledTimes(1);
    const message: string = send.mock.calls[0][0];
    expect(message).toContain('Account not created');
    expect(message).toContain('aspirant Asha (+919876543210)');
    expect(message).toContain('already in use');
    expect(message).toContain('Retry account');
  });

  it('does the same for a mentor', async () => {
    const { svc, send, provision } = setup();
    (svc as any).upsertLead = jest
      .fn()
      .mockResolvedValue({ id: 'lead2', role: 'MENTOR', status: 'NEW' });
    provision.mockRejectedValue(new Error('Something broke'));

    const ack = await svc.createMentorLead(mentorDto);

    expect(ack).toMatchObject({ id: 'lead2' });
    expect(send).toHaveBeenCalledTimes(1);
    const message: string = send.mock.calls[0][0];
    expect(message).toContain('mentor Ravi (+919876543210)');
    expect(message).toContain('Something broke');
  });

  it('shows the number as typed when it cannot be normalised', async () => {
    const { svc, send } = setup();
    (svc as any).normalizePhone = () => {
      throw new Error('bad phone');
    };

    await svc.createAspirantLead(aspirantDto);

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toContain('aspirant Asha (9876543210)');
  });

  it('still answers the form when the Slack alert also fails', async () => {
    const { svc, send, provision } = setup();
    provision.mockRejectedValue(new Error('Something broke'));
    send.mockRejectedValue(new Error('slack down'));

    await expect(svc.createAspirantLead(aspirantDto)).resolves.toMatchObject({
      id: 'lead1',
    });
  });

  it('says nothing when the account was created', async () => {
    const { svc, send } = setup();

    await svc.createAspirantLead(aspirantDto);
    await svc.createMentorLead(mentorDto);

    expect(send).not.toHaveBeenCalled();
  });

  it('says nothing when only a step after the account failed', async () => {
    const { svc, send } = setup();
    (svc as any).queueTypedChoices = jest
      .fn()
      .mockRejectedValue(new Error('queue down'));

    await svc.createAspirantLead(aspirantDto);
    await svc.createMentorLead(mentorDto);

    expect(send).not.toHaveBeenCalled();
  });
});
