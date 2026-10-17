import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../auth/guards/roles.guard.js';
import { RailwayUsageService } from './railway-usage.service.js';
import { SupabaseUsageService } from './supabase-usage.service.js';
import { SystemHealthService } from './system-health.service.js';

/**
 * Third-party infrastructure usage/limits, surfaced for the admin panel's
 * Integrations page. One route per provider (Railway + Supabase so far —
 * see CLAUDE.md's "Integrations & Usage" note for why MSG91/Firebase
 * aren't wired yet, and why Agora was tried then removed).
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/integrations')
export class IntegrationsController {
  constructor(
    private readonly railwayUsageService: RailwayUsageService,
    private readonly supabaseUsageService: SupabaseUsageService,
    private readonly systemHealthService: SystemHealthService,
  ) {}

  @Get('railway')
  getRailwayUsage() {
    return this.railwayUsageService.getUsageSummary();
  }

  @Get('supabase')
  getSupabaseUsage() {
    return this.supabaseUsageService.getUsageSummary();
  }

  /** Last-24h business health for the admin Health page. */
  @Get('health')
  getSystemHealth() {
    return this.systemHealthService.getSummary();
  }
}
