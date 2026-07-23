import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../auth/guards/roles.guard.js';
import { CreateUniversityDto } from './dto/create-university.dto.js';
import { ListUniversitiesDto } from './dto/list-universities.dto.js';
import { UpdateUniversityDto } from './dto/update-university.dto.js';
import { UniversitiesService } from './universities.service.js';

/**
 * Public, unauthenticated read API for university discovery, plus
 * ADMIN-guarded management endpoints (create/edit/activate-deactivate).
 */
@Controller('universities')
export class UniversitiesController {
  constructor(private readonly universitiesService: UniversitiesService) {}

  @Get()
  list(@Query() query: ListUniversitiesDto) {
    return this.universitiesService.findAll(query);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('admin/list')
  listAdmin(@Query() query: ListUniversitiesDto) {
    return this.universitiesService.findAllAdmin(query);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body() dto: CreateUniversityDto) {
    return this.universitiesService.create(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUniversityDto) {
    return this.universitiesService.update(id, dto);
  }

  @Get(':slug')
  detail(@Param('slug') slug: string) {
    return this.universitiesService.findBySlug(slug);
  }
}
