import { Module } from '@nestjs/common';
import { IntegrationsController } from './integrations.controller.js';
import { RailwayUsageService } from './railway-usage.service.js';

@Module({
  controllers: [IntegrationsController],
  providers: [RailwayUsageService],
})
export class IntegrationsModule {}
