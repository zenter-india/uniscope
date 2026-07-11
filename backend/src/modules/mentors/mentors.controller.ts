import { Controller, Get, Param, Query } from '@nestjs/common';
import { ListMentorsDto } from './dto/list-mentors.dto.js';
import { MentorsService } from './mentors.service.js';

/**
 * Public, unauthenticated read API for mentor discovery.
 * Only VERIFIED, mentor-available, rate-set profiles are ever returned —
 * see MentorsService for the full eligibility filter.
 */
@Controller('mentors')
export class MentorsController {
  constructor(private readonly mentorsService: MentorsService) {}

  @Get()
  list(@Query() query: ListMentorsDto) {
    return this.mentorsService.findAll(query);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.mentorsService.findById(id);
  }
}
