import { Injectable } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { CreateBroadcastDto } from './dto/create-broadcast.dto.js';

export interface BroadcastResponse {
  id: string;
  title: string;
  body: string | null;
  audience: string;
  recipientCount: number;
  createdAt: string;
}

function toResponse(row: {
  id: string;
  title: string;
  body: string | null;
  audience: string;
  recipientCount: number;
  createdAt: Date;
}): BroadcastResponse {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    audience: row.audience,
    recipientCount: row.recipientCount,
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class BroadcastsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Resolve the audience to a concrete set of recipient user ids. ADMIN
   * accounts are never included — an admin broadcasting doesn't notify
   * themselves, and there's no case for one admin messaging another here. */
  private recipientWhere(audience: string): Prisma.UserWhereInput {
    const base: Prisma.UserWhereInput = {
      isActive: true,
      isBanned: false,
      deletedAt: null,
    };
    if (audience === 'ASPIRANT') return { ...base, role: UserRole.ASPIRANT };
    if (audience === 'MENTOR') return { ...base, role: UserRole.MENTOR };
    return { ...base, role: { in: [UserRole.ASPIRANT, UserRole.MENTOR] } };
  }

  async create(dto: CreateBroadcastDto, adminUserId: string): Promise<BroadcastResponse> {
    const title = dto.title.trim();
    const body = dto.body?.trim() || undefined;

    const recipients = await this.prisma.user.findMany({
      where: this.recipientWhere(dto.audience),
      select: { id: true },
    });
    const userIds = recipients.map((r) => r.id);

    await this.notifications.sendBulk(userIds, {
      type: 'SYSTEM',
      title,
      body,
      metadata: { broadcast: 'true' },
    });

    const row = await this.prisma.broadcast.create({
      data: {
        title,
        body: body ?? null,
        audience: dto.audience,
        recipientCount: userIds.length,
        sentBy: adminUserId,
      },
    });

    return toResponse(row);
  }

  async list(): Promise<BroadcastResponse[]> {
    const rows = await this.prisma.broadcast.findMany({
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    return rows.map(toResponse);
  }

  /** Count of who a broadcast to `audience` would reach right now — powers
   * the "this will notify N people" hint before the admin sends. */
  async previewCount(audience: string): Promise<{ recipientCount: number }> {
    const recipientCount = await this.prisma.user.count({
      where: this.recipientWhere(audience),
    });
    return { recipientCount };
  }
}
