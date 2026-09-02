import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Session, SessionStatus, SessionType } from '@prisma/client';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import type { JwtPayload } from '../../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { BlocksService } from '../blocks/blocks.service.js';
import { PrismaService } from '../../database/prisma/prisma.service.js';
import { ChatService } from './chat.service.js';
import { ListMessagesDto } from './dto/list-messages.dto.js';
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
    private readonly blocksService: BlocksService,
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
    const channel = await this.chatService.ensureChannelForSession(sessionId);
    return { channel, session };
  }

  /** Reading history stays available even if either party has since
   * blocked the other (matches the rest of the app: a block never erases
   * existing access to something already shared, only stops new activity —
   * see BlocksModule doc comment) — only sendMessage is gated. */
  @Get('messages')
  async listMessages(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: JwtPayload,
    @Query() query: ListMessagesDto,
  ) {
    const { channel } = await this.requireChannel(sessionId, user.sub);
    const page = await this.chatService.listMessages(channel.id, query.before);
    return {
      ...this.chatService.connectionInfo(channel.id),
      channelId: channel.id,
      ...page,
    };
  }

  @Post('messages')
  async sendMessage(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: SendMessageDto,
  ) {
    const { channel, session } = await this.requireChannel(sessionId, user.sub);
    await this.forbidIfBlocked(session, user.sub);
    return this.chatService.sendMessage(
      channel.id,
      user.sub,
      dto.text,
      dto.clientMessageId,
    );
  }

  /** A session's two parties are always exactly the aspirant and the
   * mentor, so "the other party" is just whichever of those isn't the
   * caller — no separate participant lookup needed. */
  private async forbidIfBlocked(session: Session, callerId: string): Promise<void> {
    const otherPartyId =
      callerId === session.aspirantId ? session.mentorId : session.aspirantId;
    const blocked = await this.blocksService.isBlockedEitherDirection(
      callerId,
      otherPartyId,
    );
    if (blocked) {
      throw new ForbiddenException(
        'You cannot message this user — one of you has blocked the other',
      );
    }
  }
}
