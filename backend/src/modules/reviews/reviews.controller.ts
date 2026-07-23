import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import type { JwtPayload } from '../../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { CreateReviewDto } from './dto/create-review.dto.js';
import { ListMentorReviewsDto } from './dto/list-mentor-reviews.dto.js';
import { ReviewsService } from './reviews.service.js';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateReviewDto) {
    return this.reviewsService.create(user.sub, dto);
  }

  /** Public — reviews are part of a mentor's discoverable profile. */
  @Get('mentor/:mentorId')
  listForMentor(
    @Param('mentorId') mentorId: string,
    @Query() query: ListMentorReviewsDto,
  ) {
    return this.reviewsService.findForMentor(mentorId, query);
  }

  @UseGuards(JwtAuthGuard)
  @Get('session/:sessionId/mine')
  async hasReviewed(@Param('sessionId') sessionId: string) {
    return { reviewed: await this.reviewsService.hasReviewed(sessionId) };
  }
}
