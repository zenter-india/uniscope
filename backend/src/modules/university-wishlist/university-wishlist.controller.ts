import { Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import type { JwtPayload } from '../../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { UniversityWishlistService } from './university-wishlist.service.js';

@UseGuards(JwtAuthGuard)
@Controller('college-wishlist')
export class UniversityWishlistController {
  constructor(private readonly wishlistService: UniversityWishlistService) {}

  @Get()
  findSaved(@CurrentUser() user: JwtPayload) {
    return this.wishlistService.findSaved(user.sub);
  }

  @Get('ids')
  listSavedIds(@CurrentUser() user: JwtPayload) {
    return this.wishlistService.listSavedUniversityIds(user.sub);
  }

  @Post(':universityId')
  save(@CurrentUser() user: JwtPayload, @Param('universityId') universityId: string) {
    return this.wishlistService.save(user.sub, universityId);
  }

  @Delete(':universityId')
  unsave(@CurrentUser() user: JwtPayload, @Param('universityId') universityId: string) {
    return this.wishlistService.unsave(user.sub, universityId);
  }
}
