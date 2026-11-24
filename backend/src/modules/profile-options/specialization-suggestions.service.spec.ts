/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call --
 * This spec inspects the arguments a jest mock was called with (Prisma
 * where/orderBy trees). jest types those as `any`; typing every nested level
 * would only restate the shape the assertions already check. */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { SpecializationSuggestionsService } from './specialization-suggestions.service';

const MENTOR = { role: 'MENTOR' };

function college(over: Record<string, unknown> = {}) {
  return { mergedIntoId: null, isActive: true, ...over };
}

/** A prisma double whose pieces tests override as needed. */
function makePrisma(over: Record<string, unknown> = {}) {
  const prisma: Record<string, any> = {
    user: { findUnique: jest.fn().mockResolvedValue(MENTOR) },
    university: {
      findUnique: jest.fn().mockResolvedValue(college()),
      findUniqueOrThrow: jest.fn().mockResolvedValue(college()),
      update: jest.fn().mockResolvedValue({}),
    },
    program: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    },
    specializationSuggestion: {
      count: jest.fn().mockResolvedValue(0),
      upsert: jest.fn().mockResolvedValue({ status: 'PENDING' }),
      findUnique: jest.fn(),
      update: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          id: 's1',
          universityId: 'c1',
          degree: 'MD/MS',
          createdAt: new Date(),
          submissionCount: 1,
          university: {
            id: 'c1',
            name: 'X',
            state: 'TN',
            city: null,
            isActive: true,
          },
          ...data,
        }),
      ),
    },
    ...over,
  };
  prisma.$transaction = jest.fn((fn: (tx: unknown) => unknown) => fn(prisma));
  return prisma;
}

const svc = (prisma: unknown) =>
  new SpecializationSuggestionsService(prisma as never);

describe('SpecializationSuggestionsService.submit', () => {
  const dto = {
    universityId: 'c1',
    degree: 'md/ms',
    name: '  Community   Medicine ',
  };

  it("queues it for the mentor's college under the upper-cased degree key", async () => {
    const prisma = makePrisma();
    await expect(svc(prisma).submit('u1', dto)).resolves.toEqual({
      status: 'PENDING',
    });

    expect(prisma.specializationSuggestion.upsert).toHaveBeenCalledWith({
      where: {
        universityId_degree_nameKey: {
          universityId: 'c1',
          degree: 'MD/MS',
          nameKey: 'community medicine',
        },
      },
      create: {
        universityId: 'c1',
        degree: 'MD/MS',
        name: 'Community Medicine',
        nameKey: 'community medicine',
        firstSubmittedBy: 'u1',
      },
      update: { submissionCount: { increment: 1 } },
    });
  });

  it('lets a student suggest one too, but not an admin', async () => {
    const student = makePrisma({
      user: { findUnique: jest.fn().mockResolvedValue({ role: 'ASPIRANT' }) },
    });
    await expect(svc(student).submit('u1', dto)).resolves.toEqual({
      status: 'PENDING',
    });

    const admin = makePrisma({
      user: { findUnique: jest.fn().mockResolvedValue({ role: 'ADMIN' }) },
    });
    await expect(svc(admin).submit('u1', dto)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('does nothing when the college already lists it (any casing)', async () => {
    const prisma = makePrisma();
    prisma.program.findUnique.mockResolvedValue({
      specializations: ['COMMUNITY medicine', 'Anatomy'],
    });
    await expect(svc(prisma).submit('u1', dto)).resolves.toEqual({
      status: 'ALREADY_LISTED',
    });
    expect(prisma.specializationSuggestion.upsert).not.toHaveBeenCalled();
  });

  it('follows a merged-away college to the one that is listed', async () => {
    const prisma = makePrisma();
    prisma.university.findUnique
      .mockResolvedValueOnce(college({ mergedIntoId: 'winner' }))
      .mockResolvedValueOnce(college());
    await svc(prisma).submit('u1', dto);
    expect(
      prisma.specializationSuggestion.upsert.mock.calls[0][0].create
        .universityId,
    ).toBe('winner');
  });

  it('rejects the catch-all name and a user with too many pending', async () => {
    await expect(
      svc(makePrisma()).submit('u1', { ...dto, name: 'Others' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    const prisma = makePrisma();
    prisma.specializationSuggestion.count.mockResolvedValue(25);
    await expect(svc(prisma).submit('u1', dto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe('SpecializationSuggestionsService.review — approve', () => {
  const pendingRow = {
    id: 's1',
    universityId: 'c1',
    degree: 'MD/MS',
    name: 'community medicine',
    nameKey: 'community medicine',
    status: 'PENDING',
  };

  function approvePrisma(program: unknown, collegeRow = college()) {
    const prisma = makePrisma();
    prisma.specializationSuggestion.findUnique.mockResolvedValue(pendingRow);
    prisma.university.findUniqueOrThrow.mockResolvedValue(collegeRow);
    prisma.program.findUnique.mockResolvedValue(program);
    return prisma;
  }

  it("creates the college's program for the degree and publishes a new college", async () => {
    const prisma = approvePrisma(null, college({ isActive: false }));
    const res = await svc(prisma).review('s1', 'admin1', {
      status: 'APPROVED',
      name: 'Community Medicine',
    });

    expect(prisma.university.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { isActive: true },
    });
    expect(prisma.program.create).toHaveBeenCalledWith({
      data: {
        universityId: 'c1',
        name: 'MD/MS',
        specializations: ['Community Medicine'],
      },
    });
    expect(res.collegeActivated).toBe(true);
    expect(res.status).toBe('APPROVED');
    expect(res.name).toBe('Community Medicine');
  });

  it("adds it to the college's existing list without duplicating", async () => {
    const prisma = approvePrisma({ id: 'p1', specializations: ['Anatomy'] });
    const res = await svc(prisma).review('s1', 'admin1', {
      status: 'APPROVED',
    });

    expect(prisma.program.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: {
        specializations: ['Anatomy', 'community medicine'],
        isActive: true,
      },
    });
    expect(prisma.university.update).not.toHaveBeenCalled();
    expect(res.collegeActivated).toBe(false);

    const again = approvePrisma({
      id: 'p1',
      specializations: ['Community Medicine'],
    });
    await svc(again).review('s1', 'admin1', { status: 'APPROVED' });
    expect(again.program.update).not.toHaveBeenCalled();
  });

  it('maps onto the surviving college when the suggested one was merged away', async () => {
    const prisma = approvePrisma(null);
    prisma.university.findUnique.mockResolvedValueOnce(
      college({ mergedIntoId: 'winner' }),
    );
    prisma.university.findUnique.mockResolvedValueOnce(college());
    await svc(prisma).review('s1', 'admin1', { status: 'APPROVED' });
    expect(prisma.program.create.mock.calls[0][0].data.universityId).toBe(
      'winner',
    );
  });

  it('409s when a corrected spelling clashes with another suggestion', async () => {
    const prisma = makePrisma();
    prisma.specializationSuggestion.findUnique
      .mockResolvedValueOnce(pendingRow)
      .mockResolvedValueOnce({ id: 's2', name: 'Anatomy' });
    await expect(
      svc(prisma).review('s1', 'admin1', {
        status: 'APPROVED',
        name: 'Anatomy',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('reject and back-to-pending only change the status', async () => {
    const prisma = makePrisma();
    prisma.specializationSuggestion.findUnique.mockResolvedValue(pendingRow);
    await svc(prisma).review('s1', 'admin1', { status: 'REJECTED' });
    expect(prisma.program.create).not.toHaveBeenCalled();
    expect(prisma.program.update).not.toHaveBeenCalled();
    expect(prisma.university.update).not.toHaveBeenCalled();
    const data = prisma.specializationSuggestion.update.mock.calls[0][0].data;
    expect(data.reviewedBy).toBe('admin1');

    await svc(prisma).review('s1', 'admin1', { status: 'PENDING' });
    const undo = prisma.specializationSuggestion.update.mock.calls[1][0].data;
    expect(undo.reviewedBy).toBeNull();
  });
});

describe('SpecializationSuggestionsService — approving a profile with a suggestion', () => {
  const pending = {
    id: 's1',
    universityId: 'c1',
    degree: 'MD/MS',
    name: 'Community Medicine',
    nameKey: 'community medicine',
    status: 'PENDING',
  };

  function prismaWith(opts: {
    specialization?: string | null;
    suggestions?: unknown[];
    list?: string[];
  }) {
    const prisma = makePrisma({
      userProfile: {
        findUnique: jest.fn().mockResolvedValue({
          specialization:
            opts.specialization === undefined
              ? 'Community Medicine'
              : opts.specialization,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    });
    prisma.specializationSuggestion.findMany = jest
      .fn()
      .mockResolvedValue(opts.suggestions ?? [pending]);
    prisma.program.findMany = jest.fn().mockResolvedValue([
      {
        universityId: 'c1',
        name: 'MD/MS',
        specializations: opts.list ?? ['Anatomy', 'MD - Social & Preventive Medicine'],
      },
    ]);
    return prisma;
  }

  it('shows the pending suggestion with what the college already lists', async () => {
    const prisma = prismaWith({});
    const [row] = await svc(prisma).forApplicants([
      { universityId: 'c1', specialization: '  community  medicine ' },
    ]);
    expect(row).toEqual({
      id: 's1',
      name: 'Community Medicine',
      degree: 'MD/MS',
      collegeSpecializations: ['Anatomy', 'MD - Social & Preventive Medicine'],
    });
  });

  it('shows nothing when the applicant has no specialization or no pending suggestion', async () => {
    const none = prismaWith({ suggestions: [] });
    await expect(
      svc(none).forApplicants([
        { universityId: 'c1', specialization: 'Community Medicine' },
        { universityId: 'c1', specialization: null },
      ]),
    ).resolves.toEqual([null, null]);
    expect(none.program.findMany).not.toHaveBeenCalled();
  });

  it('does nothing when the admin made no choice', async () => {
    const prisma = prismaWith({});
    await expect(
      svc(prisma).prepareApprovalChoice('u1', 'c1', {}),
    ).resolves.toBeNull();
  });

  it('plans to add the suggestion as typed', async () => {
    await expect(
      svc(prismaWith({})).prepareApprovalChoice('u1', 'c1', {
        addSuggested: true,
      }),
    ).resolves.toEqual({ suggestionId: 's1', mode: 'ADD' });
  });

  it('plans to use an existing entry, spelled as the college has it', async () => {
    await expect(
      svc(prismaWith({})).prepareApprovalChoice('u1', 'c1', {
        useName: 'md - social & preventive medicine',
      }),
    ).resolves.toEqual({
      suggestionId: 's1',
      mode: 'USE',
      useName: 'MD - Social & Preventive Medicine',
    });
  });

  it('refuses an entry the college does not have, both choices at once, or no suggestion', async () => {
    await expect(
      svc(prismaWith({})).prepareApprovalChoice('u1', 'c1', {
        useName: 'Cardiology',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      svc(prismaWith({})).prepareApprovalChoice('u1', 'c1', {
        addSuggested: true,
        useName: 'Anatomy',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      svc(prismaWith({ suggestions: [] })).prepareApprovalChoice('u1', 'c1', {
        addSuggested: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('USE switches the profile to the existing entry and drops the typed one', async () => {
    const prisma = prismaWith({});
    prisma.specializationSuggestion.findUnique.mockResolvedValue(pending);
    await svc(prisma).applyApprovalChoice(
      { suggestionId: 's1', mode: 'USE', useName: 'Anatomy' },
      'admin1',
      'u1',
    );
    expect(prisma.userProfile.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      data: { specialization: 'Anatomy' },
    });
    expect(prisma.specializationSuggestion.update.mock.calls[0][0].data).toMatchObject(
      { status: 'REJECTED', reviewedBy: 'admin1' },
    );
  });

  it('ADD approves the suggestion, which puts it on the college list', async () => {
    const prisma = prismaWith({});
    prisma.specializationSuggestion.findUnique.mockResolvedValue(pending);
    prisma.program.findUnique.mockResolvedValue({
      id: 'p1',
      specializations: ['Anatomy'],
    });
    await svc(prisma).applyApprovalChoice(
      { suggestionId: 's1', mode: 'ADD' },
      'admin1',
      'u1',
    );
    expect(prisma.program.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: {
        specializations: ['Anatomy', 'Community Medicine'],
        isActive: true,
      },
    });
  });
});

describe('SpecializationSuggestionsService.optionsForDegree', () => {
  const programsDouble = (rows: { specializations: string[] }[]) =>
    makePrisma({ program: { findMany: jest.fn().mockResolvedValue(rows) } });

  it('lists each existing name once, A–Z, with how many colleges have it', async () => {
    const prisma = programsDouble([
      { specializations: ['MD - Microbiology', 'MD - Anatomy'] },
      { specializations: ['MD - Microbiology'] },
      { specializations: ['MD - Pharmacology', 'MD - Microbiology'] },
    ]);

    await expect(svc(prisma).optionsForDegree('MD/MS')).resolves.toEqual([
      { name: 'MD - Anatomy', colleges: 1 },
      { name: 'MD - Microbiology', colleges: 3 },
      { name: 'MD - Pharmacology', colleges: 1 },
    ]);
  });

  it('asks only for active, still-listed colleges under the upper-cased degree', async () => {
    const prisma = programsDouble([]);
    await svc(prisma).optionsForDegree('  md/ms ');

    expect(prisma.program.findMany).toHaveBeenCalledWith({
      where: {
        name: 'MD/MS',
        isActive: true,
        university: { mergedIntoId: null },
      },
      select: { specializations: true },
    });
  });

  it('treats case and spacing variants as one entry, in the most common spelling', async () => {
    const prisma = programsDouble([
      { specializations: ['MD - Microbiology'] },
      { specializations: ['MD - Microbiology'] },
      { specializations: ['md  -  microbiology'] },
    ]);

    await expect(svc(prisma).optionsForDegree('MD/MS')).resolves.toEqual([
      { name: 'MD - Microbiology', colleges: 3 },
    ]);
  });

  it('counts a college once even if it lists a name twice, and skips junk', async () => {
    const prisma = programsDouble([
      {
        specializations: [
          'MD - Anatomy',
          'MD - Anatomy',
          'Other',
          'Others',
          'X',
          '  ',
        ],
      },
    ]);

    await expect(svc(prisma).optionsForDegree('MD/MS')).resolves.toEqual([
      { name: 'MD - Anatomy', colleges: 1 },
    ]);
  });

  it('returns an empty list for a degree nobody offers, and 400s without a degree', async () => {
    await expect(
      svc(programsDouble([])).optionsForDegree('NOPE'),
    ).resolves.toEqual([]);
    await expect(
      svc(programsDouble([])).optionsForDegree('   '),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
