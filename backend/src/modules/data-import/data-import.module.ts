import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma/prisma.module.js';
import { DataImportController } from './data-import.controller.js';
import { DataImportService } from './data-import.service.js';

/**
 * Owns the admin-triggered "refresh college data" tool — re-runs the same
 * PDF/scrape capture pipeline the dataset was originally seeded from and
 * diffs the result against the live `universities` table for an admin to
 * review before anything is written. See DataImportService for the full
 * capture/diff/apply contract and backend/scripts/data/README.md for the
 * underlying scripts.
 */
@Module({
  imports: [PrismaModule],
  controllers: [DataImportController],
  providers: [DataImportService],
})
export class DataImportModule {}
