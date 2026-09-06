import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../auth/guards/roles.guard.js';
import { ChatService } from './chat.service.js';
import { ListMessagesDto } from './dto/list-messages.dto.js';
import { SendMessageDto } from './dto/send-message.dto.js';

/** ADMIN-only support inbox — the staff side of the per-user support chat.
 * Replies are sent as the SUPPORT_ACCOUNT_ID sentinel (see ChatService),
 * so from the user's app they arrive on the "UniScope Support" side of
 * their existing support thread with a push + in-app notification. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/support')
export class AdminSupportController {
  constructor(private readonly chatService: ChatService) {}

  /** Every support channel with at least one message, newest activity
   * first, `awaitingReply` flagged. */
  @Get()
  list() {
    return this.chatService.listSupportChannels();
  }

  /** One user's full support thread, cursor-paginated the same way the
   * user's own GET is. */
  @Get(':userId/messages')
  thread(@Param('userId') userId: string, @Query() query: ListMessagesDto) {
    return this.chatService.getSupportThreadForUser(userId, query.before);
  }

  /** Post a staff reply into that user's support thread. */
  @Post(':userId/messages')
  reply(@Param('userId') userId: string, @Body() dto: SendMessageDto) {
    return this.chatService.sendSupportReply(
      userId,
      dto.text,
      dto.clientMessageId,
    );
  }
}
