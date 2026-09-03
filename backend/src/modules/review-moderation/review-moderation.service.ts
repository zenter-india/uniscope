import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ReviewStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service.js';
import { ListReviewsDto } from './dto/list-reviews.dto.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export interface ModeratedReview {
  id: string;
  kind: 'mentor' | 'university';
  status: ReviewStatus;
  rating: number;
  text: string | null;
  authorId: string;
  authorName: string;
  subjectId: string;
  subjectName: string;
  createdAt: Date;
}

@Injectable()
export class ReviewModerationService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    query: ListReviewsDto,
  ): Promise<{ data: ModeratedReview[]; nextCursor: string | null }> {
    const take = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const paginate = {
      orderBy: [{ createdAt: 'desc' as const }, { id: 'asc' as const }],
      take: take + 1,
      ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
    };

    if (query.type === 'university') {
      const where: Prisma.ReviewWhereInput = {
        ...(query.status && { status: query.status }),
        ...(query.search && {
          OR: [
            { body: { contains: query.search, mode: 'insensitive' } },
            { pros: { contains: query.search, mode: 'insensitive' } },
            { cons: { contains: query.search, mode: 'insensitive' } },
          ],
        }),
      };
      const rows = await this.prisma.review.findMany({
        where,
        include: {
          author: { select: { displayName: true } },
          university: { select: { name: true } },
        },
        ...paginate,
      });
      return this.page(
        rows,
        take,
        (r): ModeratedReview => ({
          id: r.id,
          kind: 'university',
          status: r.status,
          rating: r.overallRating,
          text: r.body ?? r.pros ?? r.cons ?? null,
          authorId: r.authorId,
          authorName: r.author.displayName,
          subjectId: r.universityId,
          subjectName: r.university.name,
          createdAt: r.createdAt,
        }),
      );
    }

    const where: Prisma.MentorReviewWhereInput = {
      ...(query.status && { status: query.status }),
      ...(query.search && {
        comment: { contains: query.search, mode: 'insensitive' },
      }),
    };
    const rows = await this.prisma.mentorReview.findMany({
      where,
      include: {
        aspirant: { select: { displayName: true } },
        mentor: { select: { displayName: true } },
      },
      ...paginate,
    });
    return this.page(
      rows,
      take,
      (r): ModeratedReview => ({
        id: r.id,
        kind: 'mentor',
        status: r.status,
        rating: r.rating,
        text: r.comment,
        authorId: r.aspirantId,
        authorName: r.aspirant.displayName,
        subjectId: r.mentorId,
        subjectName: r.mentor.displayName,
        createdAt: r.createdAt,
      }),
    );
  }

  private page<T extends { id: string }>(
    rows: T[],
    take: number,
    map: (row: T) => ModeratedReview,
  ): { data: ModeratedReview[]; nextCursor: string | null } {
    const hasMore = rows.length > take;
    const slice = hasMore ? rows.slice(0, take) : rows;
    return {
      data: slice.map(map),
      nextCursor: hasMore ? slice[slice.length - 1].id : null,
    };
  }

  async setMentorReviewStatus(id: string, status: ReviewStatus): Promise<void> {
    const found = await this.prisma.mentorReview.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!found) throw new NotFoundException(`Mentor review '${id}' not found`);
    await this.prisma.mentorReview.update({ where: { id }, data: { status } });
  }

  async setUniversityReviewStatus(
    id: string,
    status: ReviewStatus,
  ): Promise<void> {
    const found = await this.prisma.review.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!found) throw new NotFoundException(`University review '${id}' not found`);
    await this.prisma.review.update({ where: { id }, data: { status } });
  }
}
