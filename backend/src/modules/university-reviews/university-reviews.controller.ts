import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import type { JwtPayload } from '../../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { CreateUniversityReviewDto } from './dto/create-university-review.dto.js';
import { ListUniversityReviewsDto } from './dto/list-university-reviews.dto.js';
import { UniversityReviewsService } from './university-reviews.service.js';

@Controller('universities/:universityId/reviews')
export class UniversityReviewsController {
  constructor(private readonly universityReviewsService: UniversityReviewsService) {}

  @Get()
  findForUniversity(
    @Param('universityId') universityId: string,
    @Query() query: ListUniversityReviewsDto,
  ) {
    return this.universityReviewsService.findForUniversity(universityId, query);
  }

  /** Backs the review summary card shown on every university's list card
   * and detail screen — category averages, recommend %, real tag counts. */
  @Get('summary')
  summary(@Param('universityId') universityId: string) {
    return this.universityReviewsService.reviewSummary(universityId);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @CurrentUser() user: JwtPayload,
    @Param('universityId') universityId: string,
    @Body() dto: CreateUniversityReviewDto,
  ) {
    return this.universityReviewsService.create(user.sub, universityId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('mine')
  hasReviewed(@CurrentUser() user: JwtPayload, @Param('universityId') universityId: string) {
    return this.universityReviewsService.hasReviewed(user.sub, universityId);
  }

  /** Full content of the caller's own review (or null) — backs the edit
   * form's prefill. Separate from `hasReviewed` above so that endpoint's
   * plain-boolean response shape stays untouched for its existing callers. */
  @UseGuards(JwtAuthGuard)
  @Get('mine/detail')
  findMine(@CurrentUser() user: JwtPayload, @Param('universityId') universityId: string) {
    return this.universityReviewsService.findMine(user.sub, universityId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch()
  update(
    @CurrentUser() user: JwtPayload,
    @Param('universityId') universityId: string,
    @Body() dto: CreateUniversityReviewDto,
  ) {
    return this.universityReviewsService.update(user.sub, universityId, dto);
  }
}
