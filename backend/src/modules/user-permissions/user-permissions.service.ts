import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { permissionsForRole } from '../../common/helpers/user-permissions.helper.js';
import { PrismaService } from '../../database/prisma/prisma.service.js';

export interface UserPermissionsView {
  user: {
    id: string;
    displayName: string;
    uniqueId: string | null;
    role: UserRole;
  };
  permissions: {
    key: string;
    label: string;
    description: string;
    allowed: boolean;
    /** Only when denied: who switched it off, when, and why. */
    deniedAt: Date | null;
    deniedBy: string | null;
    reason: string | null;
  }[];
  /** Newest first. */
  history: {
    permission: string;
    label: string;
    action: 'DENY' | 'ALLOW';
    adminEmail: string | null;
    reason: string | null;
    at: Date;
  }[];
}

export interface SetDeniedContext {
  /** Email of the admin making the change (from the admin panel's session). */
  adminEmail?: string;
  /** Required when something is newly denied. */
  reason?: string;
}

export const HISTORY_LIMIT = 30;
const REASON_MIN = 3;
const REASON_MAX = 300;

@Injectable()
export class UserPermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  private async requireAppUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, displayName: true, uniqueId: true, role: true },
    });
    if (!user) throw new NotFoundException(`User '${userId}' not found`);
    if (user.role === UserRole.ADMIN) {
      throw new BadRequestException(
        'Permissions apply to aspirants and mentors, not admin accounts',
      );
    }
    return user;
  }

  async get(userId: string): Promise<UserPermissionsView> {
    const user = await this.requireAppUser(userId);
    const [denied, events] = await Promise.all([
      this.prisma.userPermissionDenial.findMany({ where: { userId } }),
      this.prisma.userPermissionEvent.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: HISTORY_LIMIT,
      }),
    ]);
    const deniedByKey = new Map(denied.map((d) => [d.permission, d]));
    const allForRole = permissionsForRole(user.role);
    const labelOf = (key: string) =>
      allForRole.find((p) => p.key === key)?.label ?? key;
    return {
      user,
      permissions: allForRole.map((p) => {
        const row = deniedByKey.get(p.key);
        return {
          key: p.key,
          label: p.label,
          description: p.description,
          allowed: !row,
          deniedAt: row?.createdAt ?? null,
          deniedBy: row?.deniedBy ?? null,
          reason: row?.reason ?? null,
        };
      }),
      history: events.map((e) => ({
        permission: e.permission,
        label: labelOf(e.permission),
        action: e.action === 'ALLOW' ? 'ALLOW' : 'DENY',
        adminEmail: e.adminEmail,
        reason: e.reason,
        at: e.createdAt,
      })),
    };
  }

  /** Sets the user's full list of revoked permissions to `denied`. Only the
   * differences are written: an already-denied permission keeps its original
   * date, admin and reason; newly denied ones need a reason; removed ones are
   * re-allowed. Every change is added to the history. Unknown keys, or keys
   * that don't apply to the user's role, reject the whole request (nothing is
   * written). */
  async setDenied(
    userId: string,
    denied: string[],
    ctx: SetDeniedContext = {},
  ): Promise<UserPermissionsView> {
    const user = await this.requireAppUser(userId);
    const valid = new Set<string>(
      permissionsForRole(user.role).map((p) => p.key),
    );
    const unique = [...new Set(denied)];
    const bad = unique.filter((k) => !valid.has(k));
    if (bad.length) {
      throw new BadRequestException(
        `Not a permission for a ${user.role.toLowerCase()}: ${bad.join(', ')}`,
      );
    }

    const current = await this.prisma.userPermissionDenial.findMany({
      where: { userId },
      select: { permission: true },
    });
    const currentKeys = new Set(current.map((c) => c.permission));
    const toDeny = unique.filter((k) => !currentKeys.has(k));
    const toAllow = [...currentKeys].filter((k) => !unique.includes(k));

    const reason = ctx.reason?.trim() || null;
    if (toDeny.length > 0) {
      if (!reason || reason.length < REASON_MIN) {
        throw new BadRequestException(
          'Add a short reason for denying a permission (at least 3 characters).',
        );
      }
      if (reason.length > REASON_MAX) {
        throw new BadRequestException(
          `The reason is too long (at most ${REASON_MAX} characters).`,
        );
      }
    }
    const adminEmail = ctx.adminEmail?.trim().slice(0, 120) || null;

    if (toDeny.length > 0 || toAllow.length > 0) {
      await this.prisma.$transaction([
        this.prisma.userPermissionDenial.deleteMany({
          where: { userId, permission: { in: toAllow } },
        }),
        this.prisma.userPermissionDenial.createMany({
          data: toDeny.map((permission) => ({
            userId,
            permission,
            deniedBy: adminEmail,
            reason,
          })),
        }),
        this.prisma.userPermissionEvent.createMany({
          data: [
            ...toDeny.map((permission) => ({
              userId,
              permission,
              action: 'DENY',
              adminEmail,
              reason,
            })),
            ...toAllow.map((permission) => ({
              userId,
              permission,
              action: 'ALLOW',
              adminEmail,
              reason: null,
            })),
          ],
        }),
      ]);
    }
    return this.get(userId);
  }
}
