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
