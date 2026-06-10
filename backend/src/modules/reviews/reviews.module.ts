import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma/prisma.module.js';

/**
 * ReviewsModule owns the university review feature domain:
 * review submission (one per user per university), multi-dimensional
 * rating aggregation, helpful-vote tracking, full-text search,
 * and admin hide/remove moderation actions.
 */
@Module({
  imports: [PrismaModule],
  controllers: [], // Sprint 2: add ReviewsController
  providers: [], // Sprint 2: add ReviewsService
  exports: [],
})
export class ReviewsModule {}
