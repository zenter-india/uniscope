import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma/prisma.module.js';

/**
 * UniversitiesModule owns all university and program data:
 * listing, searching (full-text + autocomplete), detail pages,
 * program management, and admin CRUD operations.
 */
@Module({
  imports: [PrismaModule],
  controllers: [], // Sprint 1: add UniversitiesController
  providers: [], // Sprint 1: add UniversitiesService
  exports: [],
})
export class UniversitiesModule {}
