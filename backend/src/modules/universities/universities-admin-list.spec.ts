import { UniversitiesService } from './universities.service';

function makeService(prisma: Record<string, unknown>) {
  return new UniversitiesService(prisma as never, {} as never, {} as never);
}

describe('UniversitiesService.findAllAdmin — course filter + A–Z sort', () => {
  it('keeps only colleges offering the chosen course and sorts by name', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const svc = makeService({ university: { findMany } });

    await svc.findAllAdmin({ course: 'MD/MS', sort: 'name' });

    const args = findMany.mock.calls[0][0];
    expect(args.where.programs).toEqual({ some: { isActive: true, name: 'MD/MS' } });
    expect(args.where.mergedIntoId).toBeNull();
    expect(args.orderBy).toEqual([{ name: 'asc' }, { id: 'asc' }]);
  });

  it('sorts Z–A for sort=name_desc and newest-first by default', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const svc = makeService({ university: { findMany } });

    await svc.findAllAdmin({ sort: 'name_desc' });
    expect(findMany.mock.calls[0][0].orderBy).toEqual([{ name: 'desc' }, { id: 'asc' }]);

    await svc.findAllAdmin({});
    expect(findMany.mock.calls[1][0].orderBy).toEqual([{ createdAt: 'desc' }, { id: 'asc' }]);
  });

  it('adds no course condition when none is chosen', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const svc = makeService({ university: { findMany } });

    await svc.findAllAdmin({});

    expect(findMany.mock.calls[0][0].where.programs).toBeUndefined();
  });

  it('can combine the course filter with a text search', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const svc = makeService({ university: { findMany } });

    await svc.findAllAdmin({ course: 'DNB', search: 'basti' });

    const where = findMany.mock.calls[0][0].where;
    expect(where.programs.some.name).toBe('DNB');
    expect(where.OR).toHaveLength(4);
  });
});

describe('UniversitiesService.findAllAdmin — State, Stream and Status filters', () => {
  async function whereFor(query: Record<string, unknown>) {
    const findMany = jest.fn().mockResolvedValue([]);
    await makeService({ university: { findMany } }).findAllAdmin(query);
    return findMany.mock.calls[0][0].where;
  }

  it('narrows to a State and a Stream', async () => {
    const where = await whereFor({ state: 'Tamil Nadu', stream: 'Medical' });
    expect(where.state).toBe('Tamil Nadu');
    expect(where.stream).toBe('Medical');
  });

  it('status=inactive keeps only hidden colleges, status=active only listed ones', async () => {
    expect((await whereFor({ status: 'inactive' })).isActive).toBe(false);
    expect((await whereFor({ status: 'active' })).isActive).toBe(true);
  });

  it('lists both when no status is chosen, and never lists merged-away colleges', async () => {
    const where = await whereFor({});
    expect(where.isActive).toBeUndefined();
    expect(where.mergedIntoId).toBeNull();
  });

  it('combines with the course filter and search', async () => {
    const where = await whereFor({
      status: 'inactive',
      state: 'Kerala',
      course: 'DNB',
      search: 'hospital',
    });
    expect(where).toMatchObject({ isActive: false, state: 'Kerala' });
    expect(where.programs.some.name).toBe('DNB');
    expect(where.OR).toHaveLength(4);
  });
});

describe('UniversitiesService.listFilterOptions', () => {
  it('returns the States and Streams that exist, A–Z with counts, skipping blanks', async () => {
    const groupBy = jest
      .fn()
      .mockResolvedValueOnce([
        { state: '', _count: { _all: 3 } },
        { state: 'Kerala', _count: { _all: 120 } },
        { state: 'Tamil Nadu', _count: { _all: 340 } },
      ])
      .mockResolvedValueOnce([
        { stream: 'Engineering', _count: { _all: 900 } },
        { stream: 'Medical', _count: { _all: 500 } },
      ]);
    const options = await makeService({ university: { groupBy } }).listFilterOptions();

    expect(options.states).toEqual([
      { name: 'Kerala', colleges: 120 },
      { name: 'Tamil Nadu', colleges: 340 },
    ]);
    expect(options.streams).toEqual([
      { name: 'Engineering', colleges: 900 },
      { name: 'Medical', colleges: 500 },
    ]);
    // Merged-away colleges are not counted.
    expect(groupBy.mock.calls[0][0].where).toEqual({ mergedIntoId: null });
  });
});

describe('UniversitiesService.mergeUniversities — which colleges can be merged away', () => {
  it('accepts an inactive college (e.g. one a user typed) as the one merged away', async () => {
    const findMany = jest.fn().mockResolvedValue([{ id: 'typed', isActive: false }]);
    const prisma = {
      university: {
        findUnique: jest.fn().mockResolvedValue({ id: 'real', isActive: true }),
        findMany,
      },
      // Stop right after validation — the move itself is not under test here.
      $transaction: jest.fn().mockRejectedValue(new Error('stop after validation')),
    };
    const svc = makeService(prisma);

    await expect(svc.mergeUniversities('real', ['typed'])).rejects.toThrow(
      'stop after validation',
    );
    // Not filtered on isActive, only on "not already merged".
    expect(findMany).toHaveBeenCalledWith({
      where: { id: { in: ['typed'] }, mergedIntoId: null },
    });
  });

  it('still refuses a college that was already merged into another', async () => {
    const prisma = {
      university: {
        findUnique: jest.fn().mockResolvedValue({ id: 'real', isActive: true }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn(),
    };
    await expect(
      makeService(prisma).mergeUniversities('real', ['gone']),
    ).rejects.toThrow('already merged');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('UniversitiesService.listCourses', () => {
  it('returns distinct course names A–Z with the college count', async () => {
    const groupBy = jest.fn().mockResolvedValue([
      { name: 'DNB', _count: { universityId: 120 } },
      { name: 'MD/MS', _count: { universityId: 340 } },
    ]);
    const svc = makeService({ program: { groupBy } });

    const courses = await svc.listCourses();

    expect(courses).toEqual([
      { name: 'DNB', colleges: 120 },
      { name: 'MD/MS', colleges: 340 },
    ]);
    expect(groupBy.mock.calls[0][0].orderBy).toEqual({ name: 'asc' });
    expect(groupBy.mock.calls[0][0].where).toEqual({
      isActive: true,
      university: { mergedIntoId: null },
    });
  });
});
