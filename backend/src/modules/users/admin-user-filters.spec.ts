import { UsersService } from './users.service';

function service(prisma: Record<string, unknown>) {
  // The real constructor needs many unrelated collaborators.
  return Object.assign(Object.create(UsersService.prototype), { prisma }) as UsersService;
}

async function whereFor(query: Record<string, unknown>) {
  const findMany = jest.fn().mockResolvedValue([]);
  await service({ user: { findMany } }).findAllAdmin(query as never);
  return findMany.mock.calls[0][0].where;
}

describe('UsersService.findAllAdmin — filters', () => {
  it('adds no profile condition when no profile filter is chosen', async () => {
    const where = await whereFor({});
    expect(where.profile).toBeUndefined();
    expect(where.OR).toBeUndefined();
    expect(where.role).toEqual({ not: 'ADMIN' });
  });

  it('combines specialization, stream, degree, state, college and accepting calls', async () => {
    const where = await whereFor({
      specialization: 'Community Medicine',
      stream: 'Medical',
      qualification: 'MD/MS',
      state: 'Tamil Nadu',
      universityId: 'c1',
      accepting: 'true',
    });
    expect(where.profile.AND).toEqual([
      { specialization: 'Community Medicine' },
      { stream: 'Medical' },
      { qualification: 'MD/MS' },
      { state: 'Tamil Nadu' },
      { universityId: 'c1' },
      { isMentorAvailable: true },
    ]);
  });

  it('UG keeps the undergraduate degrees; PG the postgraduate ones plus a Medical diploma', async () => {
    const ug = await whereFor({ level: 'UG' });
    expect(ug.profile.AND[0].qualification.in).toEqual(
      expect.arrayContaining(['MBBS', 'BDS', 'UG', 'B.Tech/B.E']),
    );

    const pg = await whereFor({ level: 'PG' });
    const [byDegree, medicalDiploma] = pg.profile.AND[0].OR;
    expect(byDegree.qualification.in).toEqual(
      expect.arrayContaining(['MD/MS', 'DNB', 'DM/MCh', 'MDS', 'PG']),
    );
    expect(medicalDiploma).toEqual({ qualification: 'Diploma', stream: 'Medical' });
  });

  it('the search box finds a name, a specialization or a college', async () => {
    const where = await whereFor({ search: 'community' });
    expect(where.OR).toHaveLength(3);
    expect(where.OR[0]).toEqual({ displayName: { contains: 'community', mode: 'insensitive' } });
    expect(where.OR[1].profile.specialization.contains).toBe('community');
    expect(where.OR[2].profile.university.name.contains).toBe('community');
  });

  it('still combines with role, verification and banned', async () => {
    const where = await whereFor({
      role: 'MENTOR',
      verificationStatus: 'VERIFIED',
      isBanned: false,
      specialization: 'Anatomy',
    });
    expect(where).toMatchObject({ role: 'MENTOR', verificationStatus: 'VERIFIED', isBanned: false });
    expect(where.profile.AND).toEqual([{ specialization: 'Anatomy' }]);
  });
});

describe('UsersService.listFilterOptions', () => {
  it('returns the values that exist, A-Z with counts, skipping blanks and admins', async () => {
    const groupBy = jest
      .fn()
      .mockResolvedValueOnce([
        { specialization: 'Anatomy', _count: { _all: 4 } },
        { specialization: '  ', _count: { _all: 1 } },
        { specialization: 'Community Medicine', _count: { _all: 9 } },
      ])
      .mockResolvedValueOnce([{ qualification: 'MD/MS', _count: { _all: 12 } }])
      .mockResolvedValueOnce([{ stream: 'Medical', _count: { _all: 30 } }])
      .mockResolvedValueOnce([{ state: 'Kerala', _count: { _all: 7 } }]);
    const options = await service({ userProfile: { groupBy } }).listFilterOptions();

    expect(options.specializations).toEqual([
      { name: 'Anatomy', users: 4 },
      { name: 'Community Medicine', users: 9 },
    ]);
    expect(options.qualifications).toEqual([{ name: 'MD/MS', users: 12 }]);
    expect(options.streams).toEqual([{ name: 'Medical', users: 30 }]);
    expect(options.states).toEqual([{ name: 'Kerala', users: 7 }]);
    expect(groupBy.mock.calls[0][0].where.user).toEqual({ role: { not: 'ADMIN' } });
  });
});
