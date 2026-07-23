import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma/prisma.module.js';
import { UniversityReviewsController } from './university-reviews.controller.js';
import { UniversityReviewsService } from './university-reviews.service.js';

/**
 * University-scoped reviews (the `Review` model) — distinct from
 * MentorReview, which rates a 1:1 mentoring session. See
 * UniversityReviewsService for why this is gated to VERIFIED users.
 */
@Module({
  imports: [PrismaModule],
  controllers: [UniversityReviewsController],
  providers: [UniversityReviewsService],
  exports: [UniversityReviewsService],
})
export class UniversityReviewsModule {}
