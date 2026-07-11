import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole, VerificationStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service.js';
import { ListMentorsDto } from './dto/list-mentors.dto.js';
import { MentorResponse, toMentorResponse } from './mentor-response.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

/** A "mentor" is any VERIFIED CURRENT_STUDENT/ALUMNI who has opted into
 * mentoring and set a per-minute rate. All three conditions are required —
 * an unrated or unverified profile is never bookable or discoverable. */
const MENTOR_ROLES: UserRole[] = [UserRole.CURRENT_STUDENT, UserRole.ALUMNI];

@Injectable()
export class MentorsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cursor-paginated mentor discovery list. Ordered by createdAt desc with
   * id as a stable tiebreaker — replace with a rating-based sort once
   * mentor-level reviews exist (Review today is university-scoped only).
   */
  async findAll(
    query: ListMentorsDto,
  ): Promise<{ data: MentorResponse[]; nextCursor: string | null }> {
    const take = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

    const where: Prisma.UserWhereInput = {
      role: { in: MENTOR_ROLES },
      verificationStatus: VerificationStatus.VERIFIED,
      isActive: true,
      isBanned: false,
      deletedAt: null,
      profile: {
        isMentorAvailable: true,
        pricePerMinuteMinor: { not: null },
        ...(query.universityId && { universityId: query.universityId }),
        ...(query.specialty && {
          specialty: { contains: query.specialty, mode: 'insensitive' },
        }),
        ...(query.language && { languages: { has: query.language } }),
        ...((query.minPriceMinor !== undefined ||
          query.maxPriceMinor !== undefined) && {
          pricePerMinuteMinor: {
            not: null,
            ...(query.minPriceMinor !== undefined && {
              gte: query.minPriceMinor,
            }),
            ...(query.maxPriceMinor !== undefined && {
              lte: query.maxPriceMinor,
            }),
          },
        }),
      },
      ...(query.search && {
        OR: [
          { displayName: { contains: query.search, mode: 'insensitive' } },
          {
            profile: {
              is: { bio: { contains: query.search, mode: 'insensitive' } },
            },
          },
        ],
      }),
    };

    const rows = await this.prisma.user.findMany({
      where,
      include: { profile: { include: { university: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: take + 1,
      ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
    });

    const hasMore = rows.length > take;
    const rowsPage = hasMore ? rows.slice(0, take) : rows;
    const data = rowsPage.map(toMentorResponse);
    const nextCursor = hasMore ? rowsPage[rowsPage.length - 1].id : null;

    return { data, nextCursor };
  }

  async findById(id: string): Promise<MentorResponse> {
    const user = await this.prisma.user.findFirst({
      where: {
        id,
        role: { in: MENTOR_ROLES },
        verificationStatus: VerificationStatus.VERIFIED,
        isActive: true,
        isBanned: false,
        deletedAt: null,
        profile: { isMentorAvailable: true, pricePerMinuteMinor: { not: null } },
      },
      include: { profile: { include: { university: true } } },
    });

    if (!user) {
      throw new NotFoundException(`Mentor '${id}' not found`);
    }

    return toMentorResponse(user);
  }
}
