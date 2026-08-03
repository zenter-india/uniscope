import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service.js';
import { AvatarService } from '../avatar/avatar.service.js';
import { BlockedUserResponse } from './blocked-user-response.js';

@Injectable()
export class BlocksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly avatarService: AvatarService,
  ) {}

  /** Idempotent — blocking an already-blocked user is a no-op, not an error. */
  async block(blockerId: string, blockedId: string): Promise<{ blocked: true }> {
    if (blockerId === blockedId) {
      throw new ConflictException('You cannot block yourself');
    }

    try {
      await this.prisma.blockedUser.create({ data: { blockerId, blockedId } });
    } catch (err) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) {
        throw err;
      }
      // Already blocked — treat as success.
    }
    return { blocked: true };
  }

  /** Also idempotent — unblocking someone not blocked is a no-op. */
  async unblock(blockerId: string, blockedId: string): Promise<{ blocked: false }> {
    await this.prisma.blockedUser.deleteMany({ where: { blockerId, blockedId } });
    return { blocked: false };
  }

  async findBlocked(blockerId: string): Promise<BlockedUserResponse[]> {
    const rows = await this.prisma.blockedUser.findMany({
      where: { blockerId },
      orderBy: { createdAt: 'desc' },
      include: { blocked: { include: { profile: true } } },
    });

    return rows.map((row) => ({
      id: row.blocked.id,
      displayName: row.blocked.displayName,
      avatarUrl: row.blocked.profile
        ? this.avatarService.publicUrl(
            row.blocked.id,
            row.blocked.profile.avatarKey,
            row.blocked.profile.updatedAt,
          )
        : null,
      blockedAt: row.createdAt,
    }));
  }

  /** Checked in either direction — if either party has blocked the other,
   * neither can newly contact the other. Used to gate new session creation
   * (SessionsService.create); does not retroactively touch existing chats. */
  async isBlockedEitherDirection(userAId: string, userBId: string): Promise<boolean> {
    const count = await this.prisma.blockedUser.count({
      where: {
        OR: [
          { blockerId: userAId, blockedId: userBId },
          { blockerId: userBId, blockedId: userAId },
        ],
      },
    });
    return count > 0;
  }
}
