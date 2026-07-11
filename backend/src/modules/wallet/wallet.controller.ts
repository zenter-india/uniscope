import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import type { JwtPayload } from '../../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { CreateTopupDto } from './dto/create-topup.dto.js';
import { ListLedgerDto } from './dto/list-ledger.dto.js';
import { WalletService } from './wallet.service.js';

@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

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

    const event = JSON.parse(req.rawBody.toString('utf8'));

    if (event.event === 'payment.captured') {
      await this.walletService.handleTopupCaptured(event);
    }

    return { received: true };
  }
}
