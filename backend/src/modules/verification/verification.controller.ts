import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import type { JwtPayload } from '../../auth/decorators/current-user.decorator.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../auth/guards/roles.guard.js';
import { ReviewVerificationDto } from './dto/review-verification.dto.js';
import { SubmitVerificationDto } from './dto/submit-verification.dto.js';
import { VerificationService } from './verification.service.js';

@UseGuards(JwtAuthGuard)
@Controller('verification')
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @UseGuards(RolesGuard)
  @Roles(UserRole.MENTOR)
  @Post()
  submit(@CurrentUser() user: JwtPayload, @Body() dto: SubmitVerificationDto) {
    return this.verificationService.submit(user.sub, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.MENTOR)
  @Get('mine')
  findMine(@CurrentUser() user: JwtPayload) {
    return this.verificationService.findMine(user.sub);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('queue')
  findQueue() {
    return this.verificationService.findQueue();
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get(':id/document-url')
  async getDocumentUrl(@Param('id') id: string) {
    return { url: await this.verificationService.getDocumentUrl(id) };
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id/review')
  review(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: ReviewVerificationDto,
  ) {
    return this.verificationService.review(id, user.sub, dto);
  }
}
