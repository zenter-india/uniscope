import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma/prisma.module.js';

/**
 * QuestionsModule owns the Q&A feature domain:
 * question creation, listing (by university, tag, search),
 * answer submission and upvoting, accepted-answer marking,
 * and soft-delete moderation workflows.
 */
@Module({
  imports: [PrismaModule],
  controllers: [], // Sprint 2: add QuestionsController
  providers: [], // Sprint 2: add QuestionsService, AnswersService
  exports: [],
})
export class QuestionsModule {}
