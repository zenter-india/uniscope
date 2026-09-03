import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../auth/guards/roles.guard.js';
import { ListReviewsDto } from './dto/list-reviews.dto.js';
import { SetReviewStatusDto } from './dto/set-review-status.dto.js';
import { ReviewModerationService } from './review-moderation.service.js';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/reviews')
export class ReviewModerationController {
  constructor(private readonly service: ReviewModerationService) {}

  @Get()
  list(@Query() query: ListReviewsDto) {
    return this.service.list(query);
  }

  @Patch('mentor/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  setMentor(@Param('id') id: string, @Body() dto: SetReviewStatusDto) {
    return this.service.setMentorReviewStatus(id, dto.status);
  }

  @Patch('university/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  setUniversity(@Param('id') id: string, @Body() dto: SetReviewStatusDto) {
    return this.service.setUniversityReviewStatus(id, dto.status);
  }
}
