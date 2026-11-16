/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return --
 * This spec inspects the arguments a jest mock was called with (Prisma
 * where/orderBy trees). jest types those as `any`; typing every nested level
 * would only restate the shape the assertions already check. */
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
    expect(args.where.programs).toEqual({
      some: { isActive: true, name: 'MD/MS' },
    });
    expect(args.where.mergedIntoId).toBeNull();
    expect(args.orderBy).toEqual([{ name: 'asc' }, { id: 'asc' }]);
  });

  it('sorts Z–A for sort=name_desc and newest-first by default', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const svc = makeService({ university: { findMany } });

    await svc.findAllAdmin({ sort: 'name_desc' });
    expect(findMany.mock.calls[0][0].orderBy).toEqual([
      { name: 'desc' },
      { id: 'asc' },
    ]);

    await svc.findAllAdmin({});
    expect(findMany.mock.calls[1][0].orderBy).toEqual([
      { createdAt: 'desc' },
      { id: 'asc' },
    ]);
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
    const options = await makeService({
      university: { groupBy },
    }).listFilterOptions();

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
    const findMany = jest
      .fn()
      .mockResolvedValue([{ id: 'typed', isActive: false }]);
    const prisma = {
      university: {
        findUnique: jest.fn().mockResolvedValue({ id: 'real', isActive: true }),
        findMany,
      },
      // Stop right after validation — the move itself is not under test here.
      $transaction: jest
        .fn()
        .mockRejectedValue(new Error('stop after validation')),
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

describe('UniversitiesService.findAllAdmin — level courses (MBBS, BDS, …)', () => {
  async function whereFor(query: Record<string, unknown>) {
    const findMany = jest.fn().mockResolvedValue([]);
    await makeService({ university: { findMany } }).findAllAdmin(query);
    return findMany.mock.calls[0][0].where;
  }

  it('finds MBBS colleges by stream and level, since they have no course row', async () => {
    const where = await whereFor({ course: 'MBBS' });
    expect(where.AND).toEqual([
      {
        OR: [
          { programs: { some: { isActive: true, name: 'MBBS' } } },
          { stream: 'Medical', levels: { has: 'UG' } },
        ],
      },
    ]);
    expect(where.programs).toBeUndefined();
  });

  it('finds BDS colleges the same way', async () => {
    const where = await whereFor({ course: 'BDS' });
    expect(where.AND[0].OR[1]).toEqual({
      stream: 'Dental',
      levels: { has: 'UG' },
    });
  });

  it('B.TECH matches a program row or an engineering UG college', async () => {
    const where = await whereFor({ course: 'B.TECH' });
    expect(where.AND[0].OR).toHaveLength(2);
  });

  it('a plain program course keeps the simple programs condition', async () => {
    const where = await whereFor({ course: 'DNB' });
    expect(where.programs).toEqual({
      some: { isActive: true, name: 'DNB' },
    });
    expect(where.AND).toBeUndefined();
  });

  it('a level course still combines with a text search', async () => {
    const where = await whereFor({ course: 'MBBS', search: 'delhi' });
    expect(where.AND).toHaveLength(1);
    expect(where.OR).toHaveLength(4);
  });
});

describe('UniversitiesService.listCourses', () => {
  it('lists the program courses plus MBBS and BDS, A–Z, with their counts', async () => {
    const groupBy = jest.fn().mockResolvedValue([
      { name: 'MD/MS', _count: { universityId: 651 } },
      { name: 'DNB', _count: { universityId: 1440 } },
      { name: 'B.TECH', _count: { universityId: 3422 } },
    ]);
    const count = jest.fn().mockImplementation(({ where }) => {
      const level = JSON.stringify(where);
      if (level.includes('"Medical"')) return Promise.resolve(942);
      if (level.includes('"Dental"')) return Promise.resolve(328);
      if (level.includes('"PG"')) return Promise.resolve(4000);
      if (level.includes('"Diploma"')) return Promise.resolve(370);
      return Promise.resolve(4100); // B.TECH: programs + engineering UG colleges
    });
    const svc = makeService({ program: { groupBy }, university: { count } });

    const courses = await svc.listCourses();

    // Only active courses of colleges that are still listed.
    expect(groupBy.mock.calls[0][0].where).toEqual({
      isActive: true,
      university: { mergedIntoId: null },
    });
    expect(courses.map((c) => c.name)).toEqual([
      'B.TECH',
      'BDS',
      'DIPLOMA-ENGG',
      'DNB',
      'M.TECH',
      'MBBS',
      'MD/MS',
    ]);
    const by = Object.fromEntries(courses.map((c) => [c.name, c.colleges]));
    expect(by.MBBS).toBe(942);
    expect(by.BDS).toBe(328);
    // A level course also offered as program rows counts the union, not just
    // the program rows.
    expect(by['B.TECH']).toBe(4100);
    expect(by['MD/MS']).toBe(651);
  });
});

describe('UniversitiesService.findAllAdmin — batch size', () => {
  it('returns up to 250 colleges per batch and 500 at most', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const svc = makeService({ university: { findMany } });

    await svc.findAllAdmin({ limit: 250 });
    expect(findMany.mock.calls[0][0].take).toBe(251); // one extra to know if there is more

    await svc.findAllAdmin({ limit: 500 });
    expect(findMany.mock.calls[1][0].take).toBe(501);
  });
});
