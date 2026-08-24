import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ReviewStatus, VerificationStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service.js';
import { CreateUniversityReviewDto } from './dto/create-university-review.dto.js';
import { ListUniversityReviewsDto } from './dto/list-university-reviews.dto.js';
import {
  toUniversityReviewResponse,
  UniversityReviewResponse,
} from './university-review-response.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export interface UniversityRatingSummary {
  average: number | null;
  count: number;
}

/** Backs the review summary card — every number here is a real aggregate
 * over ACTIVE reviews, nothing invented. `categoryAverages`/`recommendPercent`
 * entries are null (not 0) when nobody has answered that question yet, so
 * the client can render "no data" rather than a misleadingly low bar. */
export interface UniversityReviewSummary {
  overallAverage: number | null;
  reviewCount: number;
  recommendPercent: number | null;
  categoryAverages: {
    academics: number | null;
    campusLife: number | null;
    workload: number | null;
    careerValue: number | null;
  };
  /** Only tags that were actually picked at least once appear here — the
   * client shows real counts, never a zero-count tag from the picklist. */
  tagCounts: Record<string, number>;
}

/**
 * University-scoped reviews (distinct from MentorReview, which rates a
 * 1:1 mentoring session). Gated to VERIFIED users only — "honest reviews
 * from verified students and alumni" is the product's core promise, so an
 * unverified account can't post one. One review per (author, university),
 * enforced at the DB level via a unique constraint.
 */
@Injectable()
export class UniversityReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    authorId: string,
    universityId: string,
    dto: CreateUniversityReviewDto,
  ): Promise<UniversityReviewResponse> {
    const [user, university] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: authorId } }),
      this.prisma.university.findUnique({ where: { id: universityId } }),
    ]);

    if (user.verificationStatus !== VerificationStatus.VERIFIED) {
      throw new ForbiddenException('Only verified students and alumni can post a review');
    }
    if (!university) {
      throw new NotFoundException(`University '${universityId}' not found`);
    }

    try {
      const review = await this.prisma.review.create({
        data: { authorId, universityId, ...dto },
        include: { author: { select: { role: true } } },
      });
      return toUniversityReviewResponse(review);
    } catch (err) {
      if (this.isUniqueConstraintError(err)) {
        throw new ConflictException('You already reviewed this university');
      }
      throw err;
    }
  }

  async findForUniversity(
    universityId: string,
    query: ListUniversityReviewsDto,
  ): Promise<{ data: UniversityReviewResponse[]; nextCursor: string | null }> {
    const take = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

    const rows = await this.prisma.review.findMany({
      where: { universityId, status: ReviewStatus.ACTIVE, deletedAt: null },
      include: { author: { select: { role: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: take + 1,
      ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
    });

    const hasMore = rows.length > take;
    const rowsPage = hasMore ? rows.slice(0, take) : rows;
    const data = rowsPage.map(toUniversityReviewResponse);
    const nextCursor = hasMore ? rowsPage[rowsPage.length - 1].id : null;

    return { data, nextCursor };
  }

  /** Used by UniversitiesService to attach {rating, reviewCount} onto
   * university list/detail responses — batchable via universityIds. */
  async ratingSummaries(universityIds: string[]): Promise<Map<string, UniversityRatingSummary>> {
    if (universityIds.length === 0) return new Map();

    const grouped = await this.prisma.review.groupBy({
      by: ['universityId'],
      where: { universityId: { in: universityIds }, status: ReviewStatus.ACTIVE, deletedAt: null },
      _avg: { overallRating: true },
      _count: { overallRating: true },
    });

    const map = new Map<string, UniversityRatingSummary>();
    for (const row of grouped) {
      map.set(row.universityId, {
        average: row._avg.overallRating,
        count: row._count.overallRating,
      });
    }
    return map;
  }

  async ratingSummary(universityId: string): Promise<UniversityRatingSummary> {
    const map = await this.ratingSummaries([universityId]);
    return map.get(universityId) ?? { average: null, count: 0 };
  }

  /** Full aggregate behind the review summary card — category averages,
   * recommend %, and real tag counts, all computed fresh from ACTIVE
   * reviews rather than cached, since review volume per university is
   * small enough that this is cheap. */
  async reviewSummary(universityId: string): Promise<UniversityReviewSummary> {
    const where = {
      universityId,
      status: ReviewStatus.ACTIVE,
      deletedAt: null,
    };

    const [aggregate, recommendYes, recommendAnswered, tagRows] = await Promise.all([
      this.prisma.review.aggregate({
        where,
        _avg: {
          overallRating: true,
          clinicalExposureRating: true,
          campusLifeRating: true,
          workloadRating: true,
          placementsRating: true,
        },
        _count: { overallRating: true },
      }),
      this.prisma.review.count({
        where: { ...where, wouldRecommend: true },
      }),
      this.prisma.review.count({
        where: { ...where, wouldRecommend: { not: null } },
      }),
      this.prisma.review.findMany({ where, select: { tags: true } }),
    ]);

    const tagCounts: Record<string, number> = {};
    for (const row of tagRows) {
      for (const tag of row.tags) {
        tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
      }
    }

    return {
      overallAverage: aggregate._avg.overallRating,
      reviewCount: aggregate._count.overallRating,
      recommendPercent:
        recommendAnswered > 0
          ? Math.round((recommendYes / recommendAnswered) * 100)
          : null,
      categoryAverages: {
        academics: aggregate._avg.clinicalExposureRating,
        campusLife: aggregate._avg.campusLifeRating,
        workload: aggregate._avg.workloadRating,
        careerValue: aggregate._avg.placementsRating,
      },
      tagCounts,
    };
  }

  /** Whether the given author has already reviewed this university — used
   * by the mobile client to decide whether to show "Write a review" vs.
   * "Edit your review". */
  async hasReviewed(authorId: string, universityId: string): Promise<boolean> {
    const existing = await this.prisma.review.findUnique({
      where: { authorId_universityId: { authorId, universityId } },
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
