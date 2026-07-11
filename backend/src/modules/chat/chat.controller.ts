import {
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  UseGuards,
} from '@nestjs/common';
import { SessionStatus, SessionType } from '@prisma/client';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import type { JwtPayload } from '../../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { PrismaService } from '../../database/prisma/prisma.service.js';
import { ChatService } from './chat.service.js';

/** Chat is readable/writable once the mentor has accepted, through session
 * completion (so either party can still read history afterward). */
const CHATTABLE_STATUSES: SessionStatus[] = [
  SessionStatus.ACCEPTED,
  SessionStatus.IN_PROGRESS,
  SessionStatus.COMPLETED,
];

@Controller('sessions/:sessionId/chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly prisma: PrismaService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('token')
  async getToken(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    // 404 (not 403) for a session the user isn't party to — same privacy
    // pattern as SessionsService.findById, avoids existence-leak.
    const session = await this.prisma.session.findFirst({
      where: {
        id: sessionId,
        OR: [{ aspirantId: user.sub }, { mentorId: user.sub }],
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
    if (!session.streamChannelId) {
      throw new NotFoundException('Chat channel has not been created yet');
    }

    return {
      token: this.chatService.generateUserToken(user.sub),
      channelId: session.streamChannelId,
      apiKey: this.chatService.getApiKey(),
    };
  }
}
