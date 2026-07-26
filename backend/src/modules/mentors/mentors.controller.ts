import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import type { JwtPayload } from '../../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { ListMentorsDto } from './dto/list-mentors.dto.js';
import { MentorsService } from './mentors.service.js';

/**
 * Public, unauthenticated read API for mentor discovery.
 * Only VERIFIED, mentor-available, rate-set profiles are ever returned —
 * see MentorsService for the full eligibility filter. The /me/dashboard-stats
 * route is the one exception — guarded, mentor-self-scoped.
 */
@Controller('mentors')
export class MentorsController {
  constructor(private readonly mentorsService: MentorsService) {}

  @Get()
  list(@Query() query: ListMentorsDto) {
    return this.mentorsService.findAll(query);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/dashboard-stats')
  dashboardStats(@CurrentUser() user: JwtPayload) {
    return this.mentorsService.getDashboardStats(user.sub);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.mentorsService.findById(id);
  }
}
