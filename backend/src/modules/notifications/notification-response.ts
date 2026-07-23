import { Notification } from '@prisma/client';

export interface NotificationResponse {
  id: string;
  type: Notification['type'];
  title: string;
  body: string | null;
  isRead: boolean;
  metadata: unknown;
  createdAt: Date;
}

export function toNotificationResponse(n: Notification): NotificationResponse {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    isRead: n.isRead,
    metadata: n.metadata,
    createdAt: n.createdAt,
  };
}
