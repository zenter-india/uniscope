import { BadRequestException, Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../auth/guards/roles.guard.js';
import { isNumericRecord } from './dto/update-settings.dto.js';
import { SettingsService } from './settings.service.js';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  getAll() {
    return this.settingsService.getAll();
  }

  @Patch()
  update(@Body() body: unknown) {
    if (!isNumericRecord(body)) {
      throw new BadRequestException('Body must be a flat object of setting key -> number');
    }
    return this.settingsService.setMany(body);
  }
}
