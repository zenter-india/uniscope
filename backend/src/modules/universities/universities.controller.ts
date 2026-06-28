import { Controller, Get, Param, Query } from '@nestjs/common';
import { ListUniversitiesDto } from './dto/list-universities.dto.js';
import { UniversitiesService } from './universities.service.js';

/**
 * Public, unauthenticated read API for university discovery.
 */
@Controller('universities')
export class UniversitiesController {
  constructor(private readonly universitiesService: UniversitiesService) {}

  @Get()
  list(@Query() query: ListUniversitiesDto) {
    return this.universitiesService.findAll(query);
  }

  @Get(':slug')
  detail(@Param('slug') slug: string) {
    return this.universitiesService.findBySlug(slug);
  }
}
