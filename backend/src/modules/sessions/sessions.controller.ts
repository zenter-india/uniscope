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
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import type { JwtPayload } from '../../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { CreateSessionDto } from './dto/create-session.dto.js';
import { ListSessionsDto } from './dto/list-sessions.dto.js';
import { SessionsService } from './sessions.service.js';

/**
 * Booking request/response/cancel legs of the session lifecycle. The
 * connect/bill/end legs are driven by provider webhooks and a billing job,
 * not by client-callable endpoints — see SessionsService for why.
 */
@UseGuards(JwtAuthGuard)
@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateSessionDto) {
    return this.sessionsService.create(user.sub, dto);
  }

  @Get()
  list(@CurrentUser() user: JwtPayload, @Query() query: ListSessionsDto) {
    return this.sessionsService.findAll(user.sub, query);
  }

  @Get(':id')
  detail(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.sessionsService.findById(id, user.sub);
  }

  @Post(':id/accept')
  @HttpCode(HttpStatus.OK)
  accept(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.sessionsService.accept(id, user.sub);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  reject(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.sessionsService.reject(id, user.sub);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.sessionsService.cancel(id, user.sub);
  }

  /** LiveKit access token for an AUDIO_CALL session — either party, once
   * ACCEPTED (or already IN_PROGRESS, for a token refresh mid-call). */
  @Get(':id/call/token')
  getCallToken(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.sessionsService.getCallCredentials(id, user.sub);
  }

  /** Dual-client connect confirmation — see SessionsService.confirmJoined.
   * Billing settles once BOTH parties have called this. */
  @Post(':id/call/joined')
  @HttpCode(HttpStatus.OK)
  confirmJoined(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.sessionsService.confirmJoined(id, user.sub);
  }

  /** Aspirant-only: bill +5 min and keep the call going. */
  @Post(':id/call/extend')
  @HttpCode(HttpStatus.OK)
  extendCall(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.sessionsService.extendCall(id, user.sub);
  }

  /** Either party ends the call. No additional billing — see
   * SessionsService.endCall. */
  @Post(':id/call/end')
  @HttpCode(HttpStatus.OK)
  endCall(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body('endReason') endReason?: string,
  ) {
    return this.sessionsService.endCall(id, user.sub, endReason);
  }
}
