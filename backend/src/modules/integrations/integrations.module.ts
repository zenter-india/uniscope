import { Module } from '@nestjs/common';
import { AgoraUsageService } from './agora-usage.service.js';
import { IntegrationsController } from './integrations.controller.js';
import { RailwayUsageService } from './railway-usage.service.js';

@Module({
  controllers: [IntegrationsController],
  providers: [RailwayUsageService, AgoraUsageService],
})
export class IntegrationsModule {}
