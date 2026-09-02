import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import type { JwtPayload } from '../../auth/decorators/current-user.decorator.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../auth/guards/roles.guard.js';
import { AdjustWalletDto } from './dto/adjust-wallet.dto.js';
import { CreateTopupDto } from './dto/create-topup.dto.js';
import { ListLedgerDto } from './dto/list-ledger.dto.js';
import { VerifyTopupDto } from './dto/verify-topup.dto.js';
import { WalletService } from './wallet.service.js';

@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  // ── ADMIN — inspect and correct any user's wallet ──────────────────────

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('admin/:userId/ledger')
  getLedgerAdmin(@Param('userId') userId: string, @Query() query: ListLedgerDto) {
    return this.walletService.getLedgerAdmin(userId, query);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('admin/:userId/adjust')
  @HttpCode(HttpStatus.OK)
  adjustBalanceAdmin(
    @Param('userId') userId: string,
    @Body() dto: AdjustWalletDto,
  ) {
    return this.walletService.adjustBalanceAdmin(userId, dto);
  }

  // ── user-facing ───────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get()
  getBalance(@CurrentUser() user: JwtPayload) {
    return this.walletService.getBalance(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Get('ledger')
  getLedger(@CurrentUser() user: JwtPayload, @Query() query: ListLedgerDto) {
    return this.walletService.getLedger(user.sub, query);
  }

  @UseGuards(JwtAuthGuard)
  @Post('topup')
  createTopup(@CurrentUser() user: JwtPayload, @Body() dto: CreateTopupDto) {
    return this.walletService.createTopupOrder(user.sub, dto);
  }

  /**
   * Direct client-confirmation path used when the webhook URL isn't
   * publicly reachable (e.g. local dev) — see WalletService.verifyAndCreditTopup.
   */
  @UseGuards(JwtAuthGuard)
  @Post('topup/verify')
  verifyTopup(@CurrentUser() user: JwtPayload, @Body() dto: VerifyTopupDto) {
    return this.walletService.verifyAndCreditTopup(user.sub, dto);
  }

  /**
   * Razorpay calls this directly — no user session exists, so it's NOT
   * behind JwtAuthGuard. Trust is established entirely by verifying the
   * HMAC signature against the raw body before touching any payload field.
   */
  @Post('topup/webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-razorpay-signature') signature: string | undefined,
  ) {
    if (!req.rawBody) {
      throw new BadRequestException('Missing raw body');
    }

    const valid = this.walletService.verifyWebhookSignature(req.rawBody, signature);
    if (!valid) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const event = JSON.parse(req.rawBody.toString('utf8')) as {
      event: string;
      payload: { payment: { entity: { id: string; order_id: string; amount: number } } };
    };

    if (event.event === 'payment.captured') {
      await this.walletService.handleTopupCaptured(event);
    }

    return { received: true };
  }
}
