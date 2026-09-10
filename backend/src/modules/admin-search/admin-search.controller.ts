import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../auth/guards/roles.guard.js';
import { AdminSearchService } from './admin-search.service.js';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/search')
export class AdminSearchController {
  constructor(private readonly service: AdminSearchService) {}

  @Get()
  search(@Query('q') q?: string) {
    return this.service.search(q ?? '');
  }
}
