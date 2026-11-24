import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../auth/guards/roles.guard.js';
import { MetricsQueryDto } from '../metrics/dto/metrics-query.dto.js';
import { ListTopupsDto } from './dto/list-topups.dto.js';
import { MoneyService } from './money.service.js';

/** ADMIN-only, read-only money reporting for the admin Money page. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/money')
export class AdminMoneyController {
  constructor(private readonly money: MoneyService) {}

  /** Money in by platform, mentor earnings, payouts — for one date range. */
  @Get('summary')
  summary(@Query() query: MetricsQueryDto) {
    return this.money.summary(query);
  }

  /** Who recharged, on which platform, for how many minutes. */
  @Get('topups')
  topups(@Query() query: ListTopupsDto) {
    return this.money.listTopups(query);
  }

  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="uniscope-topups.csv"')
  @Get('topups/export')
  exportTopups(@Query() query: ListTopupsDto) {
    return this.money.exportTopupsCsv(query);
  }

  /** Which mentor earned how much. */
  @Get('mentors')
  mentors(@Query() query: MetricsQueryDto) {
    return this.money.mentors(query);
  }

  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header(
    'Content-Disposition',
    'attachment; filename="uniscope-mentor-earnings.csv"',
  )
  @Get('mentors/export')
  exportMentors(@Query() query: MetricsQueryDto) {
    return this.money.exportMentorsCsv(query);
  }
}
