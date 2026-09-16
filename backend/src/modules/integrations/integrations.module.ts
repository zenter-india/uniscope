import { Module } from '@nestjs/common';
import { IntegrationsController } from './integrations.controller.js';
import { RailwayUsageService } from './railway-usage.service.js';
import { SupabaseUsageService } from './supabase-usage.service.js';

@Module({
  controllers: [IntegrationsController],
  providers: [RailwayUsageService, SupabaseUsageService],
})
export class IntegrationsModule {}
