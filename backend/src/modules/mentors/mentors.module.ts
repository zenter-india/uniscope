import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma/prisma.module.js';
import { MentorsController } from './mentors.controller.js';
import { MentorsService } from './mentors.service.js';

/**
 * MentorsModule owns mentor discovery: search/filter listing and mentor
 * detail pages. Mentor-becoming (opting in, setting a rate) lives in
 * UsersModule alongside the rest of profile management.
 */
@Module({
  imports: [PrismaModule],
  controllers: [MentorsController],
  providers: [MentorsService],
  exports: [MentorsService],
})
export class MentorsModule {}
