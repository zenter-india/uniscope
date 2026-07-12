import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import type { JwtPayload } from '../../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { ChatService } from './chat.service.js';

/** Separate controller (distinct route prefix) from the session-scoped
 * ChatController — support chat is available to any authenticated user at
 * any time, independent of any Session. */
@UseGuards(JwtAuthGuard)
@Controller('chat/support')
export class SupportChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('token')
  async getToken(@CurrentUser() user: JwtPayload) {
    const channelId = await this.chatService.ensureSupportChannel(user.sub);
    return {
      token: this.chatService.generateUserToken(user.sub),
      channelId,
      apiKey: this.chatService.getApiKey(),
    };
  }
}
