import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma/prisma.module.js';
import { SettingsController } from './settings.controller.js';
import { SettingsService } from './settings.service.js';

/** Admin-tunable runtime config — see settings.registry.ts for the current
 * knobs. Exported so any module can inject SettingsService instead of a
 * hardcoded constant. */
@Module({
  imports: [PrismaModule],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
