import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma/prisma.module.js';
import { UniversitiesController } from './universities.controller.js';
import { UniversitiesService } from './universities.service.js';

/**
 * UniversitiesModule owns all university and program data:
 * listing, searching (full-text + autocomplete), detail pages,
 * program management, and admin CRUD operations.
 */
@Module({
  imports: [PrismaModule],
  controllers: [UniversitiesController],
  providers: [UniversitiesService],
  exports: [UniversitiesService],
})
export class UniversitiesModule {}
