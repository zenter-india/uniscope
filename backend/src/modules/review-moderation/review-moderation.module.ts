import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma/prisma.module.js';
import { ReviewModerationController } from './review-moderation.controller.js';
import { ReviewModerationService } from './review-moderation.service.js';

/** ADMIN moderation for both review types — mentor reviews and the
 * university-scoped Review. Reads/writes the tables directly rather than
 * going through the two domain modules. */
@Module({
  imports: [PrismaModule],
  controllers: [ReviewModerationController],
  providers: [ReviewModerationService],
})
export class ReviewModerationModule {}
