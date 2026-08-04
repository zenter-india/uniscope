import { Body, Controller, Get, Param, ParseEnumPipe, Post, Query, UseGuards } from '@nestjs/common';
import { DataImportType, UserRole } from '@prisma/client';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import type { JwtPayload } from '../../auth/decorators/current-user.decorator.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../auth/guards/roles.guard.js';
import { DataImportService } from './data-import.service.js';
import { ApplyDataImportDto } from './dto/apply-data-import.dto.js';

/** Admin-only "Refresh college data" tool — see DataImportService for the
 * capture/diff/apply contract. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/data-import')
export class DataImportController {
  constructor(private readonly dataImportService: DataImportService) {}

  @Post(':type/run')
  run(@Param('type', new ParseEnumPipe(DataImportType)) type: DataImportType) {
    return this.dataImportService.run(type);
  }

  @Get()
  list(@Query('type') type?: DataImportType) {
    return this.dataImportService.listJobs(type);
  }

  @Get(':id')
  getJob(@Param('id') id: string) {
    return this.dataImportService.getJob(id);
  }

  @Post(':id/apply')
  apply(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: ApplyDataImportDto,
  ) {
    return this.dataImportService.apply(id, user.sub, dto);
  }
}
