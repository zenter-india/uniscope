import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma/prisma.module.js';
import { ReviewsModule } from '../reviews/reviews.module.js';
import { MentorsController } from './mentors.controller.js';
import { MentorsService } from './mentors.service.js';

/**
 * MentorsModule owns mentor discovery: search/filter listing and mentor
 * detail pages. Mentor-becoming (opting in, setting a rate) lives in
 * UsersModule alongside the rest of profile management. Depends on
 * ReviewsModule to attach {rating, reviewCount} summaries onto every mentor
 * response.
 */
@Module({
  imports: [PrismaModule, ReviewsModule],
  controllers: [MentorsController],
  providers: [MentorsService],
  exports: [MentorsService],
})
export class MentorsModule {}
