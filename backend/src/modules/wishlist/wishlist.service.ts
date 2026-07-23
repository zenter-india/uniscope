import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service.js';
import { MentorResponse } from '../mentors/mentor-response.js';
import { MentorsService } from '../mentors/mentors.service.js';

@Injectable()
export class WishlistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mentorsService: MentorsService,
  ) {}

  /** Idempotent — saving an already-saved mentor is a no-op, not an error.
   * Validates the mentor is a real, currently-discoverable mentor first
   * (findById throws 404 otherwise), so you can't wishlist an arbitrary
   * user id. */
  async save(aspirantId: string, mentorId: string): Promise<{ saved: true }> {
    await this.mentorsService.findById(mentorId);

    try {
      await this.prisma.savedMentor.create({ data: { aspirantId, mentorId } });
    } catch (err) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) {
        throw err;
      }
      // Already saved — treat as success.
    }
    return { saved: true };
  }

  /** Also idempotent — unsaving something not saved is a no-op. */
  async unsave(aspirantId: string, mentorId: string): Promise<{ saved: false }> {
    await this.prisma.savedMentor.deleteMany({ where: { aspirantId, mentorId } });
    return { saved: false };
  }

  async listSavedMentorIds(aspirantId: string): Promise<string[]> {
    const rows = await this.prisma.savedMentor.findMany({
      where: { aspirantId },
      select: { mentorId: true },
    });
    return rows.map((r) => r.mentorId);
  }

  /**
   * Full mentor cards for the wishlist screen. A saved mentor who has since
   * become ineligible (unverified, deactivated, rate cleared) is silently
   * dropped — MentorsService.findById is the single source of truth for
   * "is this mentor currently showable," and a wishlist entry shouldn't
   * bypass it.
   */
  async findSaved(aspirantId: string): Promise<MentorResponse[]> {
    const rows = await this.prisma.savedMentor.findMany({
      where: { aspirantId },
      orderBy: { createdAt: 'desc' },
      select: { mentorId: true },
    });

    const results = await Promise.allSettled(
      rows.map((r) => this.mentorsService.findById(r.mentorId)),
    );

    return results
      .filter((r): r is PromiseFulfilledResult<MentorResponse> => r.status === 'fulfilled')
      .map((r) => r.value);
  }
}
