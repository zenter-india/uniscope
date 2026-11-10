/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return --
 * This spec inspects the arguments a jest mock was called with (Prisma
 * where/orderBy trees). jest types those as `any`; typing every nested level
 * would only restate the shape the assertions already check. */
import { NotFoundException } from '@nestjs/common';
import { educationLevel } from './college-people.helper';
import { UniversitiesService } from './universities.service';

describe('educationLevel', () => {
  it.each([
    ['MBBS', 'UG'],
    ['BDS', 'UG'],
    ['UG', 'UG'],
    ['B.Tech/B.E', 'UG'],
    ['PG', 'PG'],
    ['MD/MS', 'PG'],
    ['DNB', 'PG'],
    ['DM/MCh', 'PG'],
    ['MDS', 'PG'],
    ['M.Tech/M.E', 'PG'],
    ['Doctorate', 'PG'],
    ['  mbbs ', 'UG'],
    ['md/ms', 'PG'],
  ])('%s is %s', (qualification, level) => {
    expect(educationLevel(qualification)).toBe(level);
  });

  it('treats a Medical diploma as PG, any other diploma, Others and blanks as OTHER', () => {
    expect(educationLevel('Diploma', 'Medical')).toBe('PG');
    expect(educationLevel('Diploma', 'Engineering')).toBe('OTHER');
    expect(educationLevel('Diploma')).toBe('OTHER');
    expect(educationLevel('Others')).toBe('OTHER');
    expect(educationLevel('Higher Secondary (12th)')).toBe('OTHER');
    expect(educationLevel(null)).toBe('OTHER');
    expect(educationLevel(undefined)).toBe('OTHER');
  });
});

describe('UniversitiesService.findCollegePeople', () => {
  const college = {
    id: 'c1',
    name: 'Sri Test Medical College',
    state: 'Tamil Nadu',
    city: 'Madurai',
    stream: 'Medical',
    isActive: true,
    mergedIntoId: null,
    programs: [{ description: 'Madurai' }],
  };
  const person = (over: Record<string, unknown> = {}) => ({
    id: 'u1',
    displayName: 'Calm Falcon #1',
    verificationStatus: 'VERIFIED',
    isBanned: false,
    profile: {
      qualification: 'MD/MS',
      stream: 'Medical',
      specialization: 'Community Medicine',
      yearOfStudy: 2,
      graduationYear: null,
    },
    ...over,
  });

  function makeService(
    over: {
      colleges?: Record<string, unknown>;
      mentors?: unknown[];
      aspirants?: unknown[];
    } = {},
  ) {
    const findMany = jest
      .fn()
      .mockImplementation(({ where }) =>
        Promise.resolve(
          where.role === 'MENTOR'
            ? (over.mentors ?? [])
            : (over.aspirants ?? []),
        ),
      );
    const findUnique = jest
      .fn()
      .mockImplementation(({ where }) =>
        Promise.resolve((over.colleges ?? { c1: college })[where.id] ?? null),
      );
    const svc = new UniversitiesService(
      { university: { findUnique }, user: { findMany } } as never,
      {} as never,
      {} as never,
    );
    return { svc, findMany, findUnique };
  }

  it('returns the college with its mentors and students, UG/PG worked out', async () => {
    const { svc } = makeService({
      mentors: [
        person(),
        person({
          id: 'u2',
          profile: {
            qualification: 'MBBS',
            stream: 'Medical',
            specialization: null,
            yearOfStudy: 4,
            graduationYear: null,
          },
        }),
      ],
      aspirants: [
        person({
          id: 'u3',
          profile: {
            qualification: 'Higher Secondary (12th)',
            stream: 'Medical',
            specialization: null,
            yearOfStudy: null,
            graduationYear: null,
          },
        }),
      ],
    });
    const res = await svc.findCollegePeople('c1');

    expect(res.college).toMatchObject({
      id: 'c1',
      name: 'Sri Test Medical College',
      district: 'Madurai',
    });
    expect(res.mentors.map((m) => [m.id, m.level])).toEqual([
      ['u1', 'PG'],
      ['u2', 'UG'],
    ]);
    expect(res.mentors[0]).toMatchObject({
      specialization: 'Community Medicine',
      yearOfStudy: 2,
    });
    expect(res.aspirants.map((a) => [a.id, a.level])).toEqual([
      ['u3', 'OTHER'],
    ]);
    expect(res.truncated).toEqual({ mentors: false, aspirants: false });
  });

  it('asks for each role separately, only live accounts linked to this college', async () => {
    const { svc, findMany } = makeService();
    await svc.findCollegePeople('c1');
    const wheres = findMany.mock.calls.map((c) => c[0].where);
    expect(wheres.map((w) => w.role).sort()).toEqual(['ASPIRANT', 'MENTOR']);
    for (const w of wheres) {
      expect(w.deletedAt).toBeNull();
      expect(w.profile).toEqual({ universityId: 'c1' });
    }
  });

  it('opens the surviving college when this one was merged away', async () => {
    const { svc, findMany } = makeService({
      colleges: {
        old: { ...college, id: 'old', mergedIntoId: 'c1' },
        c1: college,
      },
    });
    const res = await svc.findCollegePeople('old');
    expect(res.college.id).toBe('c1');
    expect(findMany.mock.calls[0][0].where.profile).toEqual({
      universityId: 'c1',
    });
  });

  it('404s for an unknown college', async () => {
    await expect(
      makeService().svc.findCollegePeople('nope'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('flags a list longer than the cap and cuts it', async () => {
    const many = Array.from({ length: 1001 }, (_, i) =>
      person({ id: `m${i}` }),
    );
    const { svc } = makeService({ mentors: many });
    const res = await svc.findCollegePeople('c1');
    expect(res.mentors).toHaveLength(1000);
    expect(res.truncated.mentors).toBe(true);
  });
});
