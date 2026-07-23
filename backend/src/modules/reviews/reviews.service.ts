import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationType, SessionStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { CreateReviewDto } from './dto/create-review.dto.js';
import { ListMentorReviewsDto } from './dto/list-mentor-reviews.dto.js';
import { MentorReviewResponse, toMentorReviewResponse } from './mentor-review-response.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export interface MentorRatingSummary {
  average: number | null;
  count: number;
}

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Only the session's aspirant may review it, only once COMPLETED, and only
   * once ever (unique sessionId — a second attempt hits the DB constraint,
   * which we translate to a friendly 409 rather than a raw P2002).
   */
  async create(aspirantId: string, dto: CreateReviewDto): Promise<MentorReviewResponse> {
    const session = await this.prisma.session.findFirst({
      where: { id: dto.sessionId, aspirantId },
    });
    if (!session) {
      // 404, not 403 — same privacy pattern used everywhere else: don't
      // confirm a session id exists to someone who isn't a party to it.
      throw new NotFoundException(`Session '${dto.sessionId}' not found`);
    }
    if (session.status !== SessionStatus.COMPLETED) {
      throw new ForbiddenException('You can only review a completed session');
    }

    try {
      const review = await this.prisma.mentorReview.create({
        data: {
          sessionId: dto.sessionId,
          mentorId: session.mentorId,
          aspirantId,
          rating: dto.rating,
          comment: dto.comment,
        },
      });

      await this.notificationsService.send({
        userId: session.mentorId,
        type: NotificationType.REVIEW,
        title: 'New review',
        body: `You received a ${dto.rating}-star review.`,
        metadata: { sessionId: session.id },
      });

      return toMentorReviewResponse(review);
    } catch (err) {
      if (this.isUniqueConstraintError(err)) {
        throw new ConflictException('You already reviewed this session');
      }
      throw err;
    }
  }

  async findForMentor(
    mentorId: string,
    query: ListMentorReviewsDto,
  ): Promise<{ data: MentorReviewResponse[]; nextCursor: string | null }> {
    const take = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

    const rows = await this.prisma.mentorReview.findMany({
      where: { mentorId },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: take + 1,
      ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
    });

    const hasMore = rows.length > take;
    const rowsPage = hasMore ? rows.slice(0, take) : rows;
    const data = rowsPage.map(toMentorReviewResponse);
    const nextCursor = hasMore ? rowsPage[rowsPage.length - 1].id : null;

    return { data, nextCursor };
  }

  /** Used by MentorsService to attach {rating, reviewCount} onto mentor
   * discovery/detail responses — batchable via mentorIds for the list view. */
  async ratingSummaries(mentorIds: string[]): Promise<Map<string, MentorRatingSummary>> {
    if (mentorIds.length === 0) return new Map();

    const grouped = await this.prisma.mentorReview.groupBy({
      by: ['mentorId'],
      where: { mentorId: { in: mentorIds } },
      _avg: { rating: true },
      _count: { rating: true },
    });

    const map = new Map<string, MentorRatingSummary>();
    for (const row of grouped) {
      map.set(row.mentorId, {
        average: row._avg.rating,
        count: row._count.rating,
      });
    }
    return map;
  }

  async ratingSummary(mentorId: string): Promise<MentorRatingSummary> {
    const map = await this.ratingSummaries([mentorId]);
    return map.get(mentorId) ?? { average: null, count: 0 };
  }

  /** Whether the given aspirant has already reviewed this session — used by
   * the mobile client to decide whether to show the "Leave a review" prompt. */
  async hasReviewed(sessionId: string): Promise<boolean> {
    const existing = await this.prisma.mentorReview.findUnique({
      where: { sessionId },
      select: { id: true },
    });
    return existing !== null;
  }

  private isUniqueConstraintError(err: unknown): boolean {
    return (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: unknown }).code === 'P2002'
    );
  }
}
