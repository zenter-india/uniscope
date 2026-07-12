import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import type { JwtPayload } from '../../auth/decorators/current-user.decorator.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../auth/guards/roles.guard.js';
import { CreateReportDto } from './dto/create-report.dto.js';
import { ListReportsDto } from './dto/list-reports.dto.js';
import { ResolveReportDto } from './dto/resolve-report.dto.js';
import { ReportsService } from './reports.service.js';

@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  /** Any authenticated user can file a report — mentor/aspirant abuse,
   * off-platform payment requests, or a dropped-call complaint. */
  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateReportDto) {
    return this.reportsService.create(user.sub, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get()
  findAll(@Query() query: ListReportsDto) {
    return this.reportsService.findAll(query);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get(':id')
  findById(@Param('id') id: string) {
    return this.reportsService.findById(id);
  }

  /** Admin-only. Resolves a report and, optionally, issues a manual
   * Uniminute refund (SESSION-targeted reports only) — see
   * ReportsService.resolve for why refunds are never automatic. */
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id/resolve')
  resolve(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: ResolveReportDto,
  ) {
    return this.reportsService.resolve(id, user.sub, dto);
  }
}
