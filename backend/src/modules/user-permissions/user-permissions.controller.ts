import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../auth/guards/roles.guard.js';
import { UserPermissionsService } from './user-permissions.service.js';

/** Admin panel -> Permissions: switch app-user permissions on/off. ADMIN-only. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/user-permissions')
export class UserPermissionsController {
  constructor(private readonly service: UserPermissionsService) {}

  @Get(':userId')
  get(@Param('userId') userId: string) {
    return this.service.get(userId);
  }

  /** Body: `{ denied: string[], reason?: string, adminEmail?: string }` --
   * `denied` is the complete list of revoked permission keys; `reason` is
   * required when something is newly denied; `adminEmail` is the signed-in
   * admin (sent by the admin panel) so the change can be attributed. */
  @Put(':userId')
  setDenied(
    @Param('userId') userId: string,
    @Body() body: { denied?: unknown; reason?: unknown; adminEmail?: unknown },
  ) {
    const denied = body?.denied;
    if (!Array.isArray(denied) || !denied.every((k) => typeof k === 'string')) {
      throw new BadRequestException('Body must be { denied: string[] }');
    }
    const text = (v: unknown) => (typeof v === 'string' ? v : undefined);
    return this.service.setDenied(userId, denied, {
      reason: text(body.reason),
      adminEmail: text(body.adminEmail),
    });
  }
}
