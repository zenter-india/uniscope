import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma/prisma.module.js';
import { MentorsModule } from '../mentors/mentors.module.js';
import { SessionsController } from './sessions.controller.js';
import { SessionsService } from './sessions.service.js';

/**
 * SessionsModule owns the booking + call lifecycle. Depends on MentorsModule
 * to reuse the single source of truth for "is this mentor bookable."
 */
@Module({
  imports: [PrismaModule, MentorsModule],
  controllers: [SessionsController],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
