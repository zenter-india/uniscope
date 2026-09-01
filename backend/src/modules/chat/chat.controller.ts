import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SessionStatus, SessionType } from '@prisma/client';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import type { JwtPayload } from '../../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { PrismaService } from '../../database/prisma/prisma.service.js';
import { ChatService } from './chat.service.js';
import { SendMessageDto } from './dto/send-message.dto.js';

/** Chat is readable/writable once the mentor has accepted, through session
 * completion (so either party can still read history afterward). */
const CHATTABLE_STATUSES: SessionStatus[] = [
  SessionStatus.ACCEPTED,
  SessionStatus.IN_PROGRESS,
  SessionStatus.COMPLETED,
];

@UseGuards(JwtAuthGuard)
@Controller('sessions/:sessionId/chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly prisma: PrismaService,
  ) {}

  /** Same authorization shape as the pre-migration Stream Chat token
   * endpoint — 404 (not 403) for a session the user isn't party to, avoids
   * existence-leak. Lazily provisions the ChatChannel on first request. */
  private async requireChannel(sessionId: string, userId: string) {
    const session = await this.prisma.session.findFirst({
      where: {
        id: sessionId,
        OR: [{ aspirantId: userId }, { mentorId: userId }],
      },
    });
    if (!session) {
      throw new NotFoundException(`Session '${sessionId}' not found`);
    }
    if (session.type !== SessionType.CHAT) {
      throw new ForbiddenException('This session is not a chat session');
    }
    if (!CHATTABLE_STATUSES.includes(session.status)) {
      throw new ForbiddenException(
        `Chat is not available while the session is ${session.status}`,
      );
    }
    return this.chatService.ensureChannelForSession(sessionId);
  }

  @Get('messages')
  async listMessages(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const channel = await this.requireChannel(sessionId, user.sub);
    return {
      ...this.chatService.connectionInfo(channel.id),
      channelId: channel.id,
      messages: await this.chatService.listMessages(channel.id),
    };
  }

  @Post('messages')
  async sendMessage(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: SendMessageDto,
  ) {
    const channel = await this.requireChannel(sessionId, user.sub);
    return this.chatService.sendMessage(channel.id, user.sub, dto.text);
  }
}
