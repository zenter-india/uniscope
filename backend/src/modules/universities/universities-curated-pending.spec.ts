/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call --
 * Inspects the arguments a jest mock was called with (Prisma where trees). */
import { UniversitiesService } from './universities.service';

/** One college whose MD/MS list has Anatomy + Physiology. */
function programRow(over: Record<string, unknown> = {}) {
  return {
    universityId: 'c1',
    description: null,
    specializations: ['Anatomy', 'Physiology'],
    university: { id: 'c1', name: 'Alpha Medical College', state: 'Tamil Nadu' },
    ...over,
  };
}

function build(opts: { programs?: unknown[]; waiting?: unknown[] }) {
  const prisma = {
    program: {
      findMany: jest.fn().mockResolvedValue(opts.programs ?? [programRow()]),
    },
    specializationSuggestion: {
      findMany: jest.fn().mockResolvedValue(opts.waiting ?? []),
    },
  };
  const service = new UniversitiesService(
    prisma as never,
    {} as never,
    {} as never,
  );
  return { service, prisma };
}

const query = { stream: 'Medical', degree: 'md/ms', browse: 'true' } as never;

describe('UniversitiesService.findCurated — typed specializations waiting for review', () => {
  it("adds what people typed to the college's dropdown straight away", async () => {
    const { service, prisma } = build({
      waiting: [{ universityId: 'c1', name: 'Community Medicine' }],
    });
    const [college] = await service.findCurated(query);
    expect(college.specializations).toEqual([
      'Anatomy',
      'Community Medicine',
      'Physiology',
    ]);
    // Only PENDING ones, for this degree and these colleges.
    expect(
      prisma.specializationSuggestion.findMany.mock.calls[0][0].where,
    ).toEqual({
      status: 'PENDING',
      degree: 'MD/MS',
      universityId: { in: ['c1'] },
    });
  });

  it('does not list a typed name twice when the college already has it (any casing)', async () => {
    const { service } = build({
      waiting: [{ universityId: 'c1', name: 'anatomy' }],
    });
    const [college] = await service.findCurated(query);
    expect(college.specializations).toEqual(['Anatomy', 'Physiology']);
  });

  it("keeps one college's typed names off another college", async () => {
    const { service } = build({
      programs: [
        programRow(),
        programRow({
          universityId: 'c2',
          university: {
            id: 'c2',
            name: 'Beta Medical College',
            state: 'Kerala',
          },
        }),
      ],
      waiting: [{ universityId: 'c2', name: 'Sports Medicine' }],
    });
    const result = await service.findCurated(query);
    const alpha = result.find((c) => c.id === 'c1');
    const beta = result.find((c) => c.id === 'c2');
    expect(alpha?.specializations).not.toContain('Sports Medicine');
    expect(beta?.specializations).toContain('Sports Medicine');
  });

  it('still lists the college when it only has a typed one so far', async () => {
    const { service } = build({
      programs: [programRow({ specializations: [] })],
      waiting: [{ universityId: 'c1', name: 'Community Medicine' }],
    });
    const result = await service.findCurated(query);
    expect(result).toHaveLength(1);
    expect(result[0].specializations).toEqual(['Community Medicine']);
  });

  it('asks for nothing extra when no college matches', async () => {
    const { service, prisma } = build({ programs: [] });
    await expect(service.findCurated(query)).resolves.toEqual([]);
    expect(prisma.specializationSuggestion.findMany).not.toHaveBeenCalled();
  });
});
