import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole, VerificationStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service.js';
import { ReviewsService } from '../reviews/reviews.service.js';
import { ListMentorsDto } from './dto/list-mentors.dto.js';
import { MentorResponse, toMentorResponse } from './mentor-response.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

/** A "mentor" is any VERIFIED user with role MENTOR who has opted into
 * mentoring. Both conditions are required — an unverified or opted-out
 * profile is never bookable or discoverable. A per-minute rate is no longer
 * a requirement: chat is free with every mentor and audio calls are always
 * billed at the flat platform rate (MENTOR_RATE_PER_MINUTE_MINOR), never a
 * mentor-set price — see product decision. */
const MENTOR_ROLES: UserRole[] = [UserRole.MENTOR];

@Injectable()
export class MentorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reviewsService: ReviewsService,
  ) {}

  /**
   * Cursor-paginated mentor discovery list. Ordered by createdAt desc with
   * id as a stable tiebreaker — replace with a rating-based sort once
   * mentor review volume is high enough to be meaningful.
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
        ...(query.universityId && { universityId: query.universityId }),
        ...(query.specialty && {
          specialty: { contains: query.specialty, mode: 'insensitive' },
        }),
        ...(query.language && { languages: { has: query.language } }),
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
    const ratings = await this.reviewsService.ratingSummaries(rowsPage.map((r) => r.id));
    const data = rowsPage.map((row) => toMentorResponse(row, ratings.get(row.id)));
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
        profile: { isMentorAvailable: true },
      },
      include: { profile: { include: { university: true } } },
    });

    if (!user) {
      throw new NotFoundException(`Mentor '${id}' not found`);
    }

    const rating = await this.reviewsService.ratingSummary(id);
    return toMentorResponse(user, rating);
  }
}
