import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import type { App } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { PrismaService } from '../../database/prisma/prisma.service.js';
import { FIREBASE_APP } from '../../firebase/firebase.constants.js';
import { NotificationResponse, toNotificationResponse } from './notification-response.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export interface SendNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  /** Arbitrary client-routing payload, e.g. { sessionId } to deep-link on tap. */
  metadata?: Record<string, string>;
}

/**
 * NotificationsService owns two things that are deliberately coupled: the
 * in-app Notification row (always written — this is the source of truth
 * the Notifications screen reads) and the best-effort FCM push to every
 * registered device (silently skipped if Firebase isn't configured, e.g.
 * local dev — see FirebaseProvider). A push failure never blocks the
 * in-app notification from being created.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(FIREBASE_APP) private readonly firebaseApp: App | null,
  ) {}

  async registerPushToken(
    userId: string,
    token: string,
    platform: 'ios' | 'android',
  ): Promise<void> {
    await this.prisma.pushToken.upsert({
      where: { token },
      create: { userId, token, platform },
      update: { userId, platform },
    });
  }

  /** Creates the in-app record and fires a best-effort push. Never throws on
   * push failure — the in-app notification is the durable part. */
  async send(params: SendNotificationParams): Promise<NotificationResponse> {
    const notification = await this.prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        body: params.body,
        metadata: params.metadata as Prisma.InputJsonValue | undefined,
      },
    });

    await this.pushToDevices(params).catch((err) => {
      this.logger.warn(`Push delivery failed for user ${params.userId}: ${err}`);
    });

    return toNotificationResponse(notification);
  }

  private async pushToDevices(params: SendNotificationParams): Promise<void> {
    if (!this.firebaseApp) return;

    const tokens = await this.prisma.pushToken.findMany({
      where: { userId: params.userId },
      select: { id: true, token: true },
    });
    if (tokens.length === 0) return;

    const messaging = getMessaging(this.firebaseApp);
    const response = await messaging.sendEachForMulticast({
      tokens: tokens.map((t) => t.token),
      notification: { title: params.title, body: params.body },
      data: { type: params.type, ...(params.metadata ?? {}) },
    });

    const staleTokenIds = response.responses
      .map((r, i) => ({ r, id: tokens[i].id }))
      .filter(
        ({ r }) =>
          !r.success &&
          (r.error?.code === 'messaging/registration-token-not-registered' ||
            r.error?.code === 'messaging/invalid-registration-token'),
      )
      .map(({ id }) => id);

    if (staleTokenIds.length > 0) {
      await this.prisma.pushToken.deleteMany({ where: { id: { in: staleTokenIds } } });
    }
  }

  async findAll(
    userId: string,
    query: { cursor?: string; limit?: number; unreadOnly?: boolean },
  ): Promise<{ data: NotificationResponse[]; nextCursor: string | null }> {
    const take = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

    const rows = await this.prisma.notification.findMany({
      where: {
        userId,
        deletedAt: null,
        ...(query.unreadOnly && { isRead: false }),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: take + 1,
      ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
    });

    const hasMore = rows.length > take;
    const rowsPage = hasMore ? rows.slice(0, take) : rows;
    const data = rowsPage.map(toNotificationResponse);
    const nextCursor = hasMore ? rowsPage[rowsPage.length - 1].id : null;

    return { data, nextCursor };
  }

  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, isRead: false, deletedAt: null },
    });
  }

  /** 404-safe by construction: scoping the update to userId means a
   * mismatched id just updates zero rows rather than leaking existence. */
  async markRead(userId: string, notificationId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }
}
