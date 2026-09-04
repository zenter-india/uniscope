import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ReviewStatus, UserRole, VerificationStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service.js';
import { CreateUniversityReviewDto } from './dto/create-university-review.dto.js';
import {
  REVIEW_CHOICE_FIELDS,
  ReviewChoiceField,
  WOULD_RECOMMEND_POSITIVE,
} from './dto/review-choices.js';
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
  /** For each of the 7 single-choice questions (Q5–Q11), a code→count map
   * of how the answers split. Only codes that were actually chosen appear.
   * Backs the "Student Experience Breakdown" bars on the summary card
   * (Phase 2) — computed here now so the aggregate endpoint stays a single
   * source of truth. */
  choiceDistributions: Record<ReviewChoiceField, Record<string, number>>;
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
      this.prisma.user.findUniqueOrThrow({
        where: { id: authorId },
        include: { profile: true },
      }),
      this.prisma.university.findUnique({ where: { id: universityId } }),
    ]);

    if (user.verificationStatus !== VerificationStatus.VERIFIED) {
      throw new ForbiddenException('Only verified students and alumni can post a review');
    }
    if (!university) {
      throw new NotFoundException(`University '${universityId}' not found`);
    }
    // A mentor's verification ties them to exactly one college (see
    // VerificationService.review's universityId link) — they can only
    // review that one, not any college they happen to be browsing. This
    // is what keeps "verified students and alumni" honest: the review is
    // tied to the same college the ID document was actually verified
    // against.
    if (user.role === UserRole.MENTOR && user.profile?.universityId !== universityId) {
      throw new ForbiddenException('You can only review your own college');
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

  /**
   * Edits the caller's own existing review — same eligibility shape as
   * create (still verified, still tied to the same college for a mentor),
   * just against the row the unique (authorId, universityId) constraint
   * already guarantees is unique. 404s (not 403) if there's nothing to
   * edit yet, matching this app's usual non-party/non-existent handling —
   * the mobile client always checks `findMine` first and only shows an
   * edit form when a review already exists, so reaching this 404 means a
   * genuinely stale client state, not a normal path.
   */
  async update(
    authorId: string,
    universityId: string,
    dto: CreateUniversityReviewDto,
  ): Promise<UniversityReviewResponse> {
    const existing = await this.prisma.review.findUnique({
      where: { authorId_universityId: { authorId, universityId } },
    });
    if (!existing) {
      throw new NotFoundException('No review to update — post one first');
    }

    const review = await this.prisma.review.update({
      where: { id: existing.id },
      data: { ...dto },
      include: { author: { select: { role: true } } },
    });
    return toUniversityReviewResponse(review);
  }

  /** Full content of the caller's own review for this university, or null
   * if they haven't posted one — backs the mobile edit form's prefill.
   * Distinct from `hasReviewed` (which only ever returns a boolean) so
   * that endpoint's existing response shape/callers are untouched. */
  async findMine(
    authorId: string,
    universityId: string,
  ): Promise<UniversityReviewResponse | null> {
    const review = await this.prisma.review.findUnique({
      where: { authorId_universityId: { authorId, universityId } },
      include: { author: { select: { role: true } } },
    });
    return review ? toUniversityReviewResponse(review) : null;
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

    const choiceFieldNames = Object.keys(
      REVIEW_CHOICE_FIELDS,
    ) as ReviewChoiceField[];

    const [aggregate, recommendYes, recommendAnswered, rows] = await Promise.all([
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
        where: { ...where, wouldRecommend: { in: [...WOULD_RECOMMEND_POSITIVE] } },
      }),
      this.prisma.review.count({
        where: { ...where, wouldRecommend: { not: null } },
      }),
      // Review volume per university is small, so pulling the choice/tag
      // columns and folding them in JS is cheaper than 8 more round trips.
      this.prisma.review.findMany({
        where,
        select: {
          tags: true,
          raggingCulture: true,
          facultyApproachability: true,
          stipendStatus: true,
          hostelAvailability: true,
          hostelSafety: true,
          wouldRecommend: true,
          valueForMoney: true,
        },
      }),
    ]);

    const tagCounts: Record<string, number> = {};
    const choiceDistributions = Object.fromEntries(
      choiceFieldNames.map((f) => [f, {} as Record<string, number>]),
    ) as Record<ReviewChoiceField, Record<string, number>>;

    for (const row of rows) {
      for (const tag of row.tags) {
        tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
      }
      for (const field of choiceFieldNames) {
        const code = row[field];
        if (code != null) {
          const dist = choiceDistributions[field];
          dist[code] = (dist[code] ?? 0) + 1;
        }
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
      choiceDistributions,
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
