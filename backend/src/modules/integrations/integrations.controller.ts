import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../auth/guards/roles.guard.js';
import { AgoraUsageService } from './agora-usage.service.js';
import { RailwayUsageService } from './railway-usage.service.js';

/**
 * Third-party infrastructure usage/limits, surfaced for the admin panel's
 * Integrations page. One route per provider (Railway + Agora so far — see
 * CLAUDE.md's "Integrations & Usage" note for why the others — Supabase,
 * MSG91, Firebase — aren't wired yet: each needs its own separate
 * credential, not the ones the app already uses operationally).
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/integrations')
export class IntegrationsController {
  constructor(
    private readonly railwayUsageService: RailwayUsageService,
    private readonly agoraUsageService: AgoraUsageService,
  ) {}

  @Get('railway')
  getRailwayUsage() {
    return this.railwayUsageService.getUsageSummary();
  }

  @Get('agora')
  getAgoraUsage() {
    return this.agoraUsageService.getUsageSummary();
  }
}
