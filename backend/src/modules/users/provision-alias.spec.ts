/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/unbound-method --
 * Mocks Prisma and inspects the arguments it was called with; jest types those
 * as `any`. */
import { UserRole } from '@prisma/client';
import { UsersService } from './users.service';

type FindManyArg = {
  where: { OR: { displayName: { equals: string } }[] };
};

/** A fake database: `taken` are display names that already belong to someone. */
function setup(taken: string[], opts: { createFails?: Error[] } = {}) {
  const failures = [...(opts.createFails ?? [])];
  const created: string[] = [];
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockImplementation(({ where }: FindManyArg) => {
        const lower = new Set(taken.map((t) => t.toLowerCase()));
        return Promise.resolve(
          where.OR.map((c) => c.displayName.equals)
            .filter((n) => lower.has(n.toLowerCase()))
            .map((displayName) => ({ displayName })),
        );
      }),
      create: jest
        .fn()
        .mockImplementation(({ data }: { data: { displayName: string } }) => {
          const failure = failures.shift();
          if (failure) return Promise.reject(failure);
          created.push(data.displayName);
          return Promise.resolve({
            id: 'u-new',
            displayName: data.displayName,
            role: UserRole.ASPIRANT,
          });
        }),
      update: jest.fn(),
    },
    userProfile: { update: jest.fn() },
    $transaction: jest
      .fn()
      .mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
  const svc = Object.assign(Object.create(UsersService.prototype), {
    prisma,
    // Avatar rendering is unrelated here.
    generateAvatarBestEffort: jest.fn().mockResolvedValue(undefined),
  }) as UsersService;
  return { svc, prisma, created };
}

const lead = (displayName?: string) => ({
  phoneHash: 'hash',
  role: UserRole.ASPIRANT,
  displayName,
  profile: {},
});

const uniqueError = (target: string) =>
  Object.assign(
    new Error(`Unique constraint failed on the constraint: \`${target}\``),
    { code: 'P2002' },
  );

describe('UsersService.provisionAccountFromLead — alias clash', () => {
  it('keeps the alias when it is free', async () => {
    const { svc, created } = setup([]);
    await svc.provisionAccountFromLead(lead('John'));
    expect(created).toEqual(['John']);
  });

  it('gives John1 when John is taken', async () => {
    const { svc, created } = setup(['John']);
    await svc.provisionAccountFromLead(lead('John'));
    expect(created).toEqual(['John1']);
  });

  it('ignores letter case: "john" is taken by "John"', async () => {
    const { svc, created } = setup(['John']);
    await svc.provisionAccountFromLead(lead('john'));
    expect(created).toEqual(['john1']);
  });

  it('keeps counting: John, John1 and John2 taken gives John3', async () => {
    const { svc, created } = setup(['John', 'john1', 'JOHN2']);
    await svc.provisionAccountFromLead(lead('John'));
    expect(created).toEqual(['John3']);
  });

  it('looks past the first batch of 25 when many are taken', async () => {
    const taken = [
      'John',
      ...Array.from({ length: 30 }, (_, i) => `John${i + 1}`),
    ];
    const { svc, created } = setup(taken);
    await svc.provisionAccountFromLead(lead('John'));
    expect(created).toEqual(['John31']);
  });

  it('picks again when someone takes the name between the check and the save', async () => {
    const { svc, created } = setup([], {
      createFails: [uniqueError('users_display_name_lower_key')],
    });
    // The first save fails; the fake database still reports the name as free,
    // so the retry would repeat it — make the second look-up see it taken.
    const findMany = svc['prisma'].user.findMany as jest.Mock;
    const original = findMany.getMockImplementation()!;
    let calls = 0;
    findMany.mockImplementation((arg: FindManyArg) => {
      calls += 1;
      if (calls >= 2) {
        return Promise.resolve([{ displayName: 'John' }]);
      }
      return original(arg);
    });
    await svc.provisionAccountFromLead(lead('John'));
    expect(created).toEqual(['John1']);
  });

  it('does not retry a clash on the phone number', async () => {
    const { svc, prisma } = setup([], {
      createFails: [uniqueError('users_phone_hash_key')],
    });
    await expect(svc.provisionAccountFromLead(lead('John'))).rejects.toThrow(
      'users_phone_hash_key',
    );
    expect(prisma.user.create).toHaveBeenCalledTimes(1);
  });

  it('gives up with the real error after repeated clashes', async () => {
    const failures = Array.from({ length: 6 }, () =>
      uniqueError('users_display_name_lower_key'),
    );
    const { svc, prisma } = setup([], { createFails: failures });
    await expect(svc.provisionAccountFromLead(lead('John'))).rejects.toThrow(
      'users_display_name_lower_key',
    );
    expect(prisma.user.create).toHaveBeenCalledTimes(5);
  });

  it('generates a name when no alias was given, without a look-up', async () => {
    const { svc, created, prisma } = setup([]);
    await svc.provisionAccountFromLead(lead(undefined));
    expect(created).toHaveLength(1);
    expect(created[0].length).toBeGreaterThan(0);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('treats a blank alias like no alias', async () => {
    const { svc, created, prisma } = setup([]);
    await svc.provisionAccountFromLead(lead('   '));
    expect(created).toHaveLength(1);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });
});

describe('UsersService.provisionAccountFromLead — aspirant becoming a mentor', () => {
  it('also resolves a free alias, and keeps the person’s own current name', async () => {
    const { svc, prisma } = setup(['Chaos']);
    const existing = {
      id: 'u-old',
      displayName: 'Chaos',
      role: UserRole.ASPIRANT,
    };
    prisma.user.findUnique.mockResolvedValue(existing);
    prisma.user.update.mockResolvedValue({
      ...existing,
      role: UserRole.MENTOR,
    });
    prisma.userProfile.update.mockResolvedValue({});

    await svc.provisionAccountFromLead({
      ...lead('Chaos'),
      role: UserRole.MENTOR,
    });

    // Their own account is excluded from the look-up, so "Chaos" stays free
    // for them and is not turned into "Chaos1".
    const lookup = prisma.user.findMany.mock.calls[0][0];
    expect(lookup.where.id).toEqual({ not: 'u-old' });
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ role: UserRole.MENTOR }),
      }),
    );
  });
});
