import { BadRequestException, Injectable } from '@nestjs/common';
import { User, UserRole } from '@prisma/client';
import { generatePseudonym } from '../../common/helpers/pseudonym.helper.js';
import { PrismaService } from '../../database/prisma/prisma.service.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { UpdateRoleDto } from './dto/update-role.dto.js';

const ALLOWED_ROLE_TRANSITIONS: Record<UserRole, UserRole[]> = {
  [UserRole.PROSPECTIVE_STUDENT]: [UserRole.CURRENT_STUDENT, UserRole.ALUMNI],
  [UserRole.CURRENT_STUDENT]: [],
  [UserRole.ALUMNI]: [],
  [UserRole.ADMIN]: [],
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findOrCreateByPhoneHash(
    phoneHash: string,
  ): Promise<{ user: User; isNewUser: boolean }> {
    const existing = await this.prisma.user.findUnique({
      where: { phoneHash },
    });

    if (existing) {
      await this.prisma.user.update({
        where: { id: existing.id },
        data: { lastActiveAt: new Date() },
      });
      return { user: existing, isNewUser: false };
    }

    const user = await this.prisma.user.create({
      data: {
        phoneHash,
        displayName: generatePseudonym(),
        role: UserRole.PROSPECTIVE_STUDENT,
        lastActiveAt: new Date(),
        profile: {
          create: {},
        },
      },
    });

    return { user, isNewUser: true };
  }

  async findById(userId: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id: userId } });
  }

  async updateRole(userId: string, dto: UpdateRoleDto): Promise<User> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    const allowed = ALLOWED_ROLE_TRANSITIONS[user.role] ?? [];
    if (!allowed.includes(dto.role)) {
      throw new BadRequestException(
        `Cannot transition from ${user.role} to ${dto.role}`,
      );
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { role: dto.role },
    });
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.displayName !== undefined && { displayName: dto.displayName }),
        ...(dto.bio !== undefined && {
          profile: { update: { bio: dto.bio } },
        }),
      },
    });
  }

  async storePushToken(
    userId: string,
    token: string,
    _platform: 'ios' | 'android',
  ): Promise<void> {
    // Push token storage is handled by the Notifications module in a later sprint.
    // Log for now so the endpoint is functional.
    console.log(`[PushToken] user=${userId} token=${token}`);
  }
}
