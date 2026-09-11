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
import { BulkSetReviewStatusDto } from './dto/bulk-set-review-status.dto.js';
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

  // Declared before the single-review `kind/:id` routes so `bulk` never
  // gets treated as a `kind` — different segment count anyway, but keeping
  // the more specific route first matches the convention used elsewhere.
  @Patch('bulk')
  @HttpCode(HttpStatus.OK)
  bulkSet(@Body() dto: BulkSetReviewStatusDto) {
    return this.service.bulkSetStatus(dto.kind, dto.ids, dto.status);
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
