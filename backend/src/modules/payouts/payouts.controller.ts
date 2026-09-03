import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { PayoutStatus, UserRole } from '@prisma/client';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import type { JwtPayload } from '../../auth/decorators/current-user.decorator.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../auth/guards/roles.guard.js';
import { ProcessPayoutDto } from './dto/process-payout.dto.js';
import { PayoutsService } from './payouts.service.js';

@UseGuards(JwtAuthGuard)
@Controller('payouts')
export class PayoutsController {
  constructor(private readonly payoutsService: PayoutsService) {}

  @UseGuards(RolesGuard)
  @Roles(UserRole.MENTOR)
  @Post()
  request(@CurrentUser() user: JwtPayload) {
    return this.payoutsService.requestPayout(user.sub);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.MENTOR)
  @Get('mine')
  findMine(@CurrentUser() user: JwtPayload) {
    return this.payoutsService.findMine(user.sub);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get()
  findAll(
    @Query('status') status?: PayoutStatus,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: string,
  ) {
    return this.payoutsService.findAll(
      status,
      sortBy,
      sortDir === 'asc' || sortDir === 'desc' ? sortDir : undefined,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id/process')
  process(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: ProcessPayoutDto,
  ) {
    return this.payoutsService.process(id, user.sub, dto);
  }
}
