/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return --
 * Mocks collaborators and inspects the arguments they were called with. */
import { EnrollmentLeadRole } from '@prisma/client';
import { EnrollmentsService } from './enrollments.service';

function setup(user: { displayName: string }, isNewUser: boolean) {
  const notifications = { send: jest.fn().mockResolvedValue({}) };
  const usersService = {
    provisionAccountFromLead: jest.fn().mockResolvedValue({
      user: { id: 'u1', role: 'ASPIRANT', ...user },
      isNewUser,
    }),
  };
  const prisma = {
    enrollmentLead: { update: jest.fn().mockResolvedValue({}) },
  };
  const svc = Object.assign(Object.create(EnrollmentsService.prototype), {
    prisma,
    usersService,
    notifications,
    logger: { warn: jest.fn(), error: jest.fn() },
    phoneHashFor: () => 'hash',
  }) as EnrollmentsService;
  return { svc, notifications };
}

const provision = (svc: EnrollmentsService, alias: string) =>
  (svc as any).provisionAccountFromLead(
    EnrollmentLeadRole.ASPIRANT,
    '+919876543210',
    { alias, fullName: 'Ayush' },
    {},
  );

describe('website sign-up — alias changed notification', () => {
  it('tells a new account its alias was changed, naming both', async () => {
    const { svc, notifications } = setup({ displayName: 'John1' }, true);
    await provision(svc, 'John');
    expect(notifications.send).toHaveBeenCalledTimes(1);
    const arg = notifications.send.mock.calls[0][0];
    expect(arg.userId).toBe('u1');
    expect(arg.body).toContain('"John"');
    expect(arg.body).toContain('"John1"');
  });

  it('says nothing when the alias was kept', async () => {
    const { svc, notifications } = setup({ displayName: 'John' }, true);
    await provision(svc, 'John');
    expect(notifications.send).not.toHaveBeenCalled();
  });

  it('says nothing when only the letter case differs', async () => {
    const { svc, notifications } = setup({ displayName: 'john' }, true);
    await provision(svc, 'John');
    expect(notifications.send).not.toHaveBeenCalled();
  });

  it('says nothing for an account that already existed', async () => {
    const { svc, notifications } = setup(
      { displayName: 'Steady Raven #7' },
      false,
    );
    await provision(svc, 'John');
    expect(notifications.send).not.toHaveBeenCalled();
  });

  it('still completes when the notification fails', async () => {
    const { svc, notifications } = setup({ displayName: 'John1' }, true);
    notifications.send.mockRejectedValue(new Error('push down'));
    await expect(provision(svc, 'John')).resolves.toBeUndefined();
  });
});
