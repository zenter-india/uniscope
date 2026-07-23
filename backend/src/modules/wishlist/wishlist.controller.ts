import { Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import type { JwtPayload } from '../../auth/decorators/current-user.decorator.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../auth/guards/roles.guard.js';
import { WishlistService } from './wishlist.service.js';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ASPIRANT)
@Controller('wishlist')
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Get()
  findSaved(@CurrentUser() user: JwtPayload) {
    return this.wishlistService.findSaved(user.sub);
  }

  @Get('ids')
  listSavedMentorIds(@CurrentUser() user: JwtPayload) {
    return this.wishlistService.listSavedMentorIds(user.sub);
  }

  @Post(':mentorId')
  save(@CurrentUser() user: JwtPayload, @Param('mentorId') mentorId: string) {
    return this.wishlistService.save(user.sub, mentorId);
  }

  @Delete(':mentorId')
  unsave(@CurrentUser() user: JwtPayload, @Param('mentorId') mentorId: string) {
    return this.wishlistService.unsave(user.sub, mentorId);
  }
}
