import { BadRequestException, Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
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

  /** Body: `{ denied: string[] }` -- the complete list of revoked permission keys. */
  @Put(':userId')
  setDenied(@Param('userId') userId: string, @Body() body: { denied?: unknown }) {
    const denied = body?.denied;
    if (!Array.isArray(denied) || !denied.every((k) => typeof k === 'string')) {
      throw new BadRequestException('Body must be { denied: string[] }');
    }
    return this.service.setDenied(userId, denied);
  }
}
