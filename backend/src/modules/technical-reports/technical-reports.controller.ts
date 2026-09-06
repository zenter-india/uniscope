import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import type { JwtPayload } from '../../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { CreateTechnicalReportDto } from './dto/create-technical-report.dto.js';
import { TechnicalReportsService } from './technical-reports.service.js';

/** "Report a technical issue" from the Help Centre — any authenticated
 * user. The admin side lives in AdminTechnicalReportsController. */
@UseGuards(JwtAuthGuard)
@Controller('support/technical-reports')
export class TechnicalReportsController {
  constructor(private readonly service: TechnicalReportsService) {}

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateTechnicalReportDto) {
    return this.service.create(user.sub, dto);
  }
}
