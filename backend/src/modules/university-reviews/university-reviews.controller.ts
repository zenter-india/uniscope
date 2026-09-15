import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
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

  /** A bare boolean response body (no wrapping object) trips a real
   * Express/NestJS quirk: `res.send(true)` sends `Content-Type: text/html`,
   * not `application/json`, since Express only auto-detects JSON for
   * objects/arrays, not raw booleans. A client that trusts the content-type
   * to decide how to parse the body (Dio does) can then silently fail to
   * read the real value — which a blanket catch on the mobile side turned
   * into "treat any failure here as not-yet-reviewed", incorrectly
   * reopening the write form for a mentor who'd already submitted. Every
   * other boolean-returning endpoint in this codebase already wraps its
   * response in an object for exactly this reason (see ReviewsController's
   * `{ reviewed: ... }`, UsersController's `{ available: ... }`) — this one
   * had just been missed. */
  @UseGuards(JwtAuthGuard)
  @Get('mine')
  async hasReviewed(
    @CurrentUser() user: JwtPayload,
    @Param('universityId') universityId: string,
  ) {
    return {
      hasReviewed: await this.universityReviewsService.hasReviewed(user.sub, universityId),
    };
  }

  /** Full content of the caller's own review, or null. Kept for the college
   * detail screen's "your review" section — a review is write-once, there is
   * no edit form to prefill. */
  @UseGuards(JwtAuthGuard)
  @Get('mine/detail')
  findMine(@CurrentUser() user: JwtPayload, @Param('universityId') universityId: string) {
    return this.universityReviewsService.findMine(user.sub, universityId);
  }
}
