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
}
