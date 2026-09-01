import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import type { JwtPayload } from '../../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { ChatService } from './chat.service.js';
import { SendMessageDto } from './dto/send-message.dto.js';

/** Separate controller (distinct route prefix) from the session-scoped
 * ChatController — support chat is available to any authenticated user at
 * any time, independent of any Session. */
@UseGuards(JwtAuthGuard)
@Controller('chat/support')
export class SupportChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('messages')
  async listMessages(@CurrentUser() user: JwtPayload) {
    const channel = await this.chatService.ensureSupportChannel(user.sub);
    return {
      ...this.chatService.connectionInfo(channel.id),
      channelId: channel.id,
      messages: await this.chatService.listMessages(channel.id),
    };
  }

  @Post('messages')
  async sendMessage(@CurrentUser() user: JwtPayload, @Body() dto: SendMessageDto) {
    const channel = await this.chatService.ensureSupportChannel(user.sub);
    return this.chatService.sendMessage(channel.id, user.sub, dto.text);
  }
}
