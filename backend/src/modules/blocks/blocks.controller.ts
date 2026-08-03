import { Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import type { JwtPayload } from '../../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { BlocksService } from './blocks.service.js';

@UseGuards(JwtAuthGuard)
@Controller('blocks')
export class BlocksController {
  constructor(private readonly blocksService: BlocksService) {}

  @Get()
  findBlocked(@CurrentUser() user: JwtPayload) {
    return this.blocksService.findBlocked(user.sub);
  }

  @Post(':userId')
  block(@CurrentUser() user: JwtPayload, @Param('userId') userId: string) {
    return this.blocksService.block(user.sub, userId);
  }

  @Delete(':userId')
  unblock(@CurrentUser() user: JwtPayload, @Param('userId') userId: string) {
    return this.blocksService.unblock(user.sub, userId);
  }
}
