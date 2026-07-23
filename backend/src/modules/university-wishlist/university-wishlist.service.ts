import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, University } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service.js';
import { UniversityReviewsService } from '../university-reviews/university-reviews.service.js';

@Injectable()
export class UniversityWishlistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly universityReviewsService: UniversityReviewsService,
  ) {}

  /** Idempotent — saving an already-saved university is a no-op, not an
   * error. Validates the university exists and is active first. */
  async save(aspirantId: string, universityId: string): Promise<{ saved: true }> {
    const university = await this.prisma.university.findFirst({
      where: { id: universityId, isActive: true },
    });
    if (!university) {
      throw new NotFoundException(`University '${universityId}' not found`);
    }

    try {
      await this.prisma.savedUniversity.create({ data: { aspirantId, universityId } });
    } catch (err) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) {
        throw err;
      }
      // Already saved — treat as success.
    }
    return { saved: true };
  }

  async unsave(aspirantId: string, universityId: string): Promise<{ saved: false }> {
    await this.prisma.savedUniversity.deleteMany({ where: { aspirantId, universityId } });
    return { saved: false };
  }

  async listSavedUniversityIds(aspirantId: string): Promise<string[]> {
    const rows = await this.prisma.savedUniversity.findMany({
      where: { aspirantId },
      select: { universityId: true },
    });
    return rows.map((r) => r.universityId);
  }

  /** Full university cards for the saved-colleges screen. A saved
   * university that's since been deactivated is silently dropped, same
   * pattern as WishlistService.findSaved for mentors. */
  async findSaved(
    aspirantId: string,
  ): Promise<(University & { rating: number | null; reviewCount: number })[]> {
    const rows = await this.prisma.savedUniversity.findMany({
      where: { aspirantId },
      orderBy: { createdAt: 'desc' },
      include: { university: true },
    });

    const active = rows.map((r) => r.university).filter((u) => u.isActive);
    const ratings = await this.universityReviewsService.ratingSummaries(active.map((u) => u.id));

    return active.map((u) => ({
      ...u,
      rating: ratings.get(u.id)?.average ?? null,
      reviewCount: ratings.get(u.id)?.count ?? 0,
    }));
  }
}
