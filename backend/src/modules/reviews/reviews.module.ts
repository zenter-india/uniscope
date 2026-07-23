import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma/prisma.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { ReviewsController } from './reviews.controller.js';
import { ReviewsService } from './reviews.service.js';

/**
 * ReviewsModule owns MENTOR reviews (MentorReview: one rating+comment per
 * completed session, distinct from the university-scoped `Review` model).
 * Exported so MentorsService can attach {rating, reviewCount} summaries onto
 * mentor discovery/detail responses.
 *
 * University reviews (the `Review` model — multi-dimensional ratings on a
 * college, not a mentor) are a separate, still-unbuilt feature; this module
 * intentionally does not cover them.
 */
@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [ReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
