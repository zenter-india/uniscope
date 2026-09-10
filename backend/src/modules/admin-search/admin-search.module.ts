import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma/prisma.module.js';
import { AdminSearchController } from './admin-search.controller.js';
import { AdminSearchService } from './admin-search.service.js';

/** Cross-entity quick lookup for the admin panel header search box. */
@Module({
  imports: [PrismaModule],
  controllers: [AdminSearchController],
  providers: [AdminSearchService],
})
export class AdminSearchModule {}
