import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
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
        metadata: params.metadata,
      },
    });
    this.logger.log(
      `[notify] created id=${notification.id} type=${params.type} userId=${params.userId}`,
    );

    await this.pushToDevices(params).catch((err) => {
      this.logger.warn(`Push delivery failed for user ${params.userId}: ${err}`);
    });

    return toNotificationResponse(notification);
  }

  /**
   * Fan-out variant of `send` for admin broadcasts: writes one in-app
   * Notification row per user in a single `createMany`, then fires a
   * best-effort push in batches (FCM multicast caps at 500 tokens/call).
   * Never throws on push failure — same contract as `send`.
   */
  async sendBulk(
    userIds: string[],
    params: { type: NotificationType; title: string; body?: string; metadata?: Record<string, string> },
  ): Promise<void> {
    if (userIds.length === 0) return;

    await this.prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        type: params.type,
        title: params.title,
        body: params.body,
        metadata: params.metadata,
      })),
    });
    this.logger.log(
      `[notify] bulk created count=${userIds.length} type=${params.type} title="${params.title}"`,
    );

    await this.pushBulk(userIds, params).catch((err) => {
      this.logger.warn(`[notify] bulk push failed: ${err}`);
    });
  }

  private async pushBulk(
    userIds: string[],
    params: { type: NotificationType; title: string; body?: string; metadata?: Record<string, string> },
  ): Promise<void> {
    if (!this.firebaseApp) {
      this.logger.log(`[notify] bulk push SKIPPED (Firebase not configured) type=${params.type}`);
      return;
    }
    const tokens = await this.prisma.pushToken.findMany({
      where: { userId: { in: userIds } },
      select: { id: true, token: true },
    });
    if (tokens.length === 0) {
      this.logger.log(`[notify] bulk push SKIPPED (no registered devices) type=${params.type}`);
      return;
    }

    const messaging = getMessaging(this.firebaseApp);
    const dataPayload = { type: params.type, ...(params.metadata ?? {}) };
    const CHUNK = 500;
    const staleTokenIds: string[] = [];
    let success = 0;
    let failure = 0;

    for (let i = 0; i < tokens.length; i += CHUNK) {
      const batch = tokens.slice(i, i + CHUNK);
      const response = await messaging.sendEachForMulticast({
        tokens: batch.map((t) => t.token),
        notification: { title: params.title, body: params.body },
        data: dataPayload,
      });
      success += response.successCount;
      failure += response.failureCount;
      response.responses.forEach((r, j) => {
        if (
          !r.success &&
          (r.error?.code === 'messaging/registration-token-not-registered' ||
            r.error?.code === 'messaging/invalid-registration-token')
        ) {
          staleTokenIds.push(batch[j].id);
        }
      });
    }

    this.logger.log(
      `[notify] bulk push result type=${params.type} devices=${tokens.length} ` +
        `success=${success} failure=${failure}`,
    );
    if (staleTokenIds.length > 0) {
      await this.prisma.pushToken.deleteMany({ where: { id: { in: staleTokenIds } } });
    }
  }

  private async pushToDevices(params: SendNotificationParams): Promise<void> {
    if (!this.firebaseApp) {
      this.logger.log(
        `[notify] push SKIPPED (Firebase not configured) type=${params.type} userId=${params.userId}`,
      );
      return;
    }

    const tokens = await this.prisma.pushToken.findMany({
      where: { userId: params.userId },
      select: { id: true, token: true },
    });
    if (tokens.length === 0) {
      this.logger.log(
        `[notify] push SKIPPED (no registered devices) type=${params.type} userId=${params.userId}`,
      );
      return;
    }

    const messaging = getMessaging(this.firebaseApp);
    // data payload is what mobile's push_service.dart _handleDeepLink reads —
    // logging its keys (never token values) is the fastest way to confirm
    // whether e.g. sessionType actually made it into a given push.
    const dataPayload = { type: params.type, ...(params.metadata ?? {}) };
    this.logger.log(
      `[notify] push dispatch type=${params.type} userId=${params.userId} ` +
        `devices=${tokens.length} dataKeys=[${Object.keys(dataPayload).join(',')}]`,
    );
    const response = await messaging.sendEachForMulticast({
      tokens: tokens.map((t) => t.token),
      notification: { title: params.title, body: params.body },
      data: dataPayload,
    });
    this.logger.log(
      `[notify] push result type=${params.type} userId=${params.userId} ` +
        `success=${response.successCount} failure=${response.failureCount}`,
    );

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
