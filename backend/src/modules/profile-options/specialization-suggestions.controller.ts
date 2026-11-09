import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CustomDegreeStatus, UserRole } from '@prisma/client';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import type { JwtPayload } from '../../auth/decorators/current-user.decorator.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../auth/guards/roles.guard.js';
import {
  ReviewSpecializationSuggestionDto,
  SubmitSpecializationSuggestionDto,
} from './dto/specialization-suggestion.dto.js';
import { SpecializationSuggestionsService } from './specialization-suggestions.service.js';

/** A mentor's specialization for their college that the college's list lacks
 * — queued for admin approval. Mentors only (the service checks the role). */
@UseGuards(JwtAuthGuard)
@Controller('profile-options/specializations')
export class SpecializationSuggestionsController {
  constructor(private readonly suggestions: SpecializationSuggestionsService) {}

  @Post()
  submit(
    @CurrentUser() user: JwtPayload,
    @Body() dto: SubmitSpecializationSuggestionDto,
  ) {
    return this.suggestions.submit(user.sub, dto);
  }
}

/** ADMIN-only queue: approve (which maps the specialization onto the college
 * and publishes it if needed), reject, or fix the spelling first. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/specialization-suggestions')
export class AdminSpecializationSuggestionsController {
  constructor(private readonly suggestions: SpecializationSuggestionsService) {}

  @Get()
  list(
    @Query('status') status?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedStatus =
      status === 'PENDING' || status === 'APPROVED' || status === 'REJECTED'
        ? (status as CustomDegreeStatus)
        : undefined;
    return this.suggestions.findAllForAdmin({
      status: parsedStatus,
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Patch(':id')
  review(
    @Param('id') id: string,
    @Body() dto: ReviewSpecializationSuggestionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.suggestions.review(id, user.sub, dto);
  }
}
