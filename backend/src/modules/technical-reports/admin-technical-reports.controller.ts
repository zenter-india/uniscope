import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TechnicalReportStatus, UserRole } from '@prisma/client';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import type { JwtPayload } from '../../auth/decorators/current-user.decorator.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../auth/guards/roles.guard.js';
import { ResolveTechnicalReportDto } from './dto/resolve-technical-report.dto.js';
import { TechnicalReportsService } from './technical-reports.service.js';

/** ADMIN-only queue of "Report a technical issue" submissions. Surfaced in
 * the admin panel's Support page ("Technical reports" tab). */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/technical-reports')
export class AdminTechnicalReportsController {
  constructor(private readonly service: TechnicalReportsService) {}

  @Get()
  list(
    @Query('status') status?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedStatus =
      status === 'OPEN' || status === 'RESOLVED'
        ? (status as TechnicalReportStatus)
        : undefined;
    return this.service.findAllForAdmin({
      status: parsedStatus,
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Patch(':id')
  resolve(
    @Param('id') id: string,
    @Body() dto: ResolveTechnicalReportDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.resolve(id, user.sub, dto);
  }
}
