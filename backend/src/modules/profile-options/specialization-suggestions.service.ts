import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CustomDegreeStatus,
  Prisma,
  SpecializationSuggestion,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service.js';
import { tidyDegreeName } from './custom-degrees.service.js';
import type {
  ReviewSpecializationSuggestionDto,
  SubmitSpecializationSuggestionDto,
} from './dto/specialization-suggestion.dto.js';

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;
/** Stops one account flooding the admin queue. */
const MAX_PENDING_PER_USER = 25;
/** The picker's own catch-all label — never a real specialization. */
const RESERVED_KEYS = new Set(['other', 'others']);

type SuggestionWithCollege = SpecializationSuggestion & {
  university: {
    id: string;
    name: string;
    state: string;
    city: string | null;
    isActive: boolean;
  };
};

export interface SpecializationSuggestionResponse {
  id: string;
  university: {
    id: string;
    name: string;
    state: string;
    city: string | null;
    isActive: boolean;
  };
  degree: string;
  name: string;
  status: CustomDegreeStatus;
  submissionCount: number;
  createdAt: Date;
  reviewedAt: Date | null;
  /** Only on an approval: the college was inactive and has now been published. */
  collegeActivated?: boolean;
}

const COLLEGE_SELECT = {
  university: {
    select: { id: true, name: true, state: true, city: true, isActive: true },
  },
} as const;

function toResponse(
  row: SuggestionWithCollege,
  collegeActivated?: boolean,
): SpecializationSuggestionResponse {
  return {
    id: row.id,
    university: row.university,
    degree: row.degree,
    name: row.name,
    status: row.status,
    submissionCount: row.submissionCount,
    createdAt: row.createdAt,
    reviewedAt: row.reviewedAt,
    ...(collegeActivated !== undefined && { collegeActivated }),
  };
}

const isUsable = (name: string, nameKey: string) =>
  name.length >= 2 && nameKey.length <= 100 && !RESERVED_KEYS.has(nameKey);

const sameName = (list: string[], nameKey: string) =>
  list.some((s) => s.trim().toLowerCase() === nameKey);

/**
 * Specializations a mentor entered for their own college that the college's
 * list doesn't have yet. An admin approves them; approving adds the
 * specialization to that college's Program for the degree (creating the
 * Program, and publishing the college, if need be), which is exactly what the
 * app's college picker reads — so the next person who picks the college sees it.
 */
@Injectable()
export class SpecializationSuggestionsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Follows "merged into" links to the college that is actually listed. */
  private async resolveCollegeId(
    db: Prisma.TransactionClient | PrismaService,
    id: string,
  ): Promise<string> {
    let current = id;
    for (let hop = 0; hop < 5; hop++) {
      const u = await db.university.findUnique({
        where: { id: current },
        select: { mergedIntoId: true },
      });
      if (!u) throw new NotFoundException('College not found');
      if (!u.mergedIntoId) return current;
      current = u.mergedIntoId;
    }
    return current;
  }

  async submit(
    userId: string,
    dto: SubmitSpecializationSuggestionDto,
  ): Promise<{ status: CustomDegreeStatus | 'ALREADY_LISTED' }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (user?.role !== UserRole.MENTOR) {
      throw new ForbiddenException(
        'Only mentors can suggest a specialization for their college.',
      );
    }

    const { name, nameKey } = tidyDegreeName(dto.name);
    if (!isUsable(name, nameKey)) {
      throw new BadRequestException('Enter the name of the specialization.');
    }
    const degree = dto.degree.trim().toUpperCase();
    const universityId = await this.resolveCollegeId(
      this.prisma,
      dto.universityId,
    );

    // Already on the college's list — nothing to ask an admin about.
    const program = await this.prisma.program.findUnique({
      where: { universityId_name: { universityId, name: degree } },
      select: { specializations: true },
    });
    if (program && sameName(program.specializations, nameKey)) {
      return { status: 'ALREADY_LISTED' };
    }

    const pending = await this.prisma.specializationSuggestion.count({
      where: { firstSubmittedBy: userId, status: CustomDegreeStatus.PENDING },
    });
    if (pending >= MAX_PENDING_PER_USER) {
      throw new BadRequestException(
        'You already have several suggestions waiting for review.',
      );
    }

    const row = await this.prisma.specializationSuggestion.upsert({
      where: {
        universityId_degree_nameKey: { universityId, degree, nameKey },
      },
      create: { universityId, degree, name, nameKey, firstSubmittedBy: userId },
      update: { submissionCount: { increment: 1 } },
    });
    return { status: row.status };
  }

  async findAllForAdmin(query: {
    status?: CustomDegreeStatus;
    cursor?: string;
    limit?: number;
  }): Promise<{
    data: SpecializationSuggestionResponse[];
    nextCursor: string | null;
  }> {
    const take = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const rows = await this.prisma.specializationSuggestion.findMany({
      where: query.status ? { status: query.status } : undefined,
      include: COLLEGE_SELECT,
      // Most-requested first, so what matters most is at the top.
      orderBy: [
        { submissionCount: 'desc' },
        { createdAt: 'desc' },
        { id: 'asc' },
      ],
      take: take + 1,
      ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
    });
    const hasMore = rows.length > take;
    const page = hasMore ? rows.slice(0, take) : rows;
    return {
      data: page.map((r) => toResponse(r)),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  async review(
    id: string,
    adminId: string,
    dto: ReviewSpecializationSuggestionDto,
  ): Promise<SpecializationSuggestionResponse> {
    const existing = await this.prisma.specializationSuggestion.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Suggestion not found');

    let name = existing.name;
    let nameKey = existing.nameKey;
    if (dto.name !== undefined) {
      const tidied = tidyDegreeName(dto.name);
      if (!isUsable(tidied.name, tidied.nameKey)) {
        throw new BadRequestException('Enter a valid specialization name.');
      }
      if (tidied.nameKey !== existing.nameKey) {
        const clash = await this.prisma.specializationSuggestion.findUnique({
          where: {
            universityId_degree_nameKey: {
              universityId: existing.universityId,
              degree: existing.degree,
              nameKey: tidied.nameKey,
            },
          },
        });
        if (clash) {
          throw new ConflictException(
            `"${clash.name}" is already suggested for this college — reject this one instead.`,
          );
        }
      }
      name = tidied.name;
      nameKey = tidied.nameKey;
    }

    const pending = dto.status === 'PENDING';
    const reviewData = {
      name,
      nameKey,
      status: dto.status as CustomDegreeStatus,
      reviewedBy: pending ? null : adminId,
      reviewedAt: pending ? null : new Date(),
    };

    if (dto.status !== 'APPROVED') {
      const row = await this.prisma.specializationSuggestion.update({
        where: { id },
        data: reviewData,
        include: COLLEGE_SELECT,
      });
      return toResponse(row);
    }

    // Approve: map the specialization onto the college, publishing the college
    // if it is still the inactive row created when a mentor typed it.
    return this.prisma.$transaction(async (tx) => {
      const collegeId = await this.resolveCollegeId(tx, existing.universityId);
      const college = await tx.university.findUniqueOrThrow({
        where: { id: collegeId },
        select: { isActive: true },
      });
      let collegeActivated = false;
      if (!college.isActive) {
        await tx.university.update({
          where: { id: collegeId },
          data: { isActive: true },
        });
        collegeActivated = true;
      }

      const program = await tx.program.findUnique({
        where: {
          universityId_name: { universityId: collegeId, name: existing.degree },
        },
      });
      if (!program) {
        await tx.program.create({
          data: {
            universityId: collegeId,
            name: existing.degree,
            specializations: [name],
          },
        });
      } else if (!sameName(program.specializations, nameKey)) {
        await tx.program.update({
          where: { id: program.id },
          data: {
            specializations: [...program.specializations, name],
            isActive: true,
          },
        });
      }

      const row = await tx.specializationSuggestion.update({
        where: { id },
        data: reviewData,
        include: COLLEGE_SELECT,
      });
      return toResponse(row, collegeActivated);
    });
  }
}
