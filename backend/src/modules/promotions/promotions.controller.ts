import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import type { JwtPayload } from '../../auth/decorators/current-user.decorator.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../auth/guards/roles.guard.js';
import {
  CreatePromotionDto,
  MAX_SELECTED_USERS,
  PROMOTION_AUDIENCES,
} from './dto/create-promotion.dto.js';
import { PromotionsService } from './promotions.service.js';

/** ADMIN: send a promotion (popup + notification + optional link and wallet
 * credit) and see what was sent. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/promotions')
export class AdminPromotionsController {
  constructor(private readonly service: PromotionsService) {}

  @Get()
  list() {
    return this.service.list();
  }

  /** How many people a promotion to this audience would reach. `userIds` is a
   * comma-separated list, only read for audience=SELECTED. */
  @Get('preview')
  preview(
    @Query('audience') audience?: string,
    @Query('userIds') userIds?: string,
  ) {
    const a = PROMOTION_AUDIENCES.includes(audience as never)
      ? (audience as string)
      : 'ALL';
    const ids = (userIds ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, MAX_SELECTED_USERS);
    return this.service.previewCount(a, ids);
  }

  @Post()
  create(@Body() dto: CreatePromotionDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.sub);
  }
}

/** The signed-in user's own popups: what to show on app open, and a note that
 * it was shown. */
@UseGuards(JwtAuthGuard)
@Controller('promotions')
export class PromotionsController {
  constructor(private readonly service: PromotionsService) {}

  @Get('pending')
  pending(@CurrentUser() user: JwtPayload) {
    return this.service.pendingFor(user.sub);
  }

  @Post(':id/seen')
  @HttpCode(HttpStatus.NO_CONTENT)
  async seen(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    await this.service.markSeen(user.sub, id);
  }
}
