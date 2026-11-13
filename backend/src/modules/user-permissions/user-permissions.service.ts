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
  }[];
}

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
    const denied = await this.prisma.userPermissionDenial.findMany({
      where: { userId },
      select: { permission: true },
    });
    const deniedKeys = new Set(denied.map((d) => d.permission));
    return {
      user,
      permissions: permissionsForRole(user.role).map((p) => ({
        key: p.key,
        label: p.label,
        description: p.description,
        allowed: !deniedKeys.has(p.key),
      })),
    };
  }

  /** Replaces the user's full set of revoked permissions with `denied`.
   * Unknown keys, or keys that don't apply to the user's role, reject the
   * whole request (nothing is written). */
  async setDenied(
    userId: string,
    denied: string[],
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
    await this.prisma.$transaction([
      this.prisma.userPermissionDenial.deleteMany({ where: { userId } }),
      this.prisma.userPermissionDenial.createMany({
        data: unique.map((permission) => ({ userId, permission })),
      }),
    ]);
    return this.get(userId);
  }
}
