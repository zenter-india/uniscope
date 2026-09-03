import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import type { JwtPayload } from '../../auth/decorators/current-user.decorator.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../auth/guards/roles.guard.js';
import { BroadcastsService } from './broadcasts.service.js';
import { BROADCAST_AUDIENCES, CreateBroadcastDto } from './dto/create-broadcast.dto.js';

/** ADMIN-only broadcast announcements — fan out one in-app notification
 * (type SYSTEM) + a best-effort push to every active aspirant and/or
 * mentor. See BroadcastsService for the audience contract. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/broadcasts')
export class BroadcastsController {
  constructor(private readonly service: BroadcastsService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Get('preview')
  preview(@Query('audience') audience?: string) {
    const a = BROADCAST_AUDIENCES.includes(audience as never) ? (audience as string) : 'ALL';
    return this.service.previewCount(a);
  }

  @Post()
  create(@Body() dto: CreateBroadcastDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.sub);
  }
}
