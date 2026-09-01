import { ChatMessage } from '@prisma/client';

export interface ChatMessageResponse {
  id: string;
  channelId: string;
  senderId: string;
  text: string;
  createdAt: Date;
}

export function toChatMessageResponse(message: ChatMessage): ChatMessageResponse {
  return {
    id: message.id,
    channelId: message.channelId,
    senderId: message.senderId,
    text: message.text,
    createdAt: message.createdAt,
  };
}
