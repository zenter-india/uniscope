import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, User, UserRole } from '@prisma/client';
import { generatePseudonym } from '../../common/helpers/pseudonym.helper.js';
import { PrismaService } from '../../database/prisma/prisma.service.js';
import { ListUsersDto } from './dto/list-users.dto.js';
import { SetBannedDto } from './dto/set-banned.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { UpdateRoleDto } from './dto/update-role.dto.js';

const ALLOWED_ROLE_TRANSITIONS: Record<UserRole, UserRole[]> = {
  [UserRole.ASPIRANT]: [UserRole.MENTOR],
  [UserRole.MENTOR]: [],
  [UserRole.ADMIN]: [],
};

const ADMIN_DEFAULT_LIMIT = 20;
const ADMIN_MAX_LIMIT = 50;

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
        role: UserRole.ASPIRANT,
        lastActiveAt: new Date(),
        profile: {
          create: {},
        },
        wallet: {
          create: {},
        },
      },
    });

    return { user, isNewUser: true };
  }

  async findById(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: { include: { university: true } } },
    });
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

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    if (dto.isMentorAvailable !== undefined) {
      const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
      if (user.role !== UserRole.MENTOR) {
        throw new BadRequestException('Only mentors can set mentoring availability');
      }
    }

    const profileUpdate = {
      ...(dto.bio !== undefined && { bio: dto.bio }),
      ...(dto.specialty !== undefined && { specialty: dto.specialty }),
      ...(dto.languages !== undefined && { languages: dto.languages }),
      ...(dto.availableDays !== undefined && { availableDays: dto.availableDays }),
      ...(dto.isMentorAvailable !== undefined && {
        isMentorAvailable: dto.isMentorAvailable,
      }),
      ...(dto.gender !== undefined && { gender: dto.gender }),
      ...(dto.state !== undefined && { state: dto.state }),
      ...(dto.city !== undefined && { city: dto.city }),
      ...(dto.qualification !== undefined && { qualification: dto.qualification }),
      ...(dto.stream !== undefined && { stream: dto.stream }),
      ...(dto.goals !== undefined && { goals: dto.goals }),
      ...(dto.dateOfBirth !== undefined && { dateOfBirth: new Date(dto.dateOfBirth) }),
      ...(dto.courseInterested !== undefined && { courseInterested: dto.courseInterested }),
      ...(dto.preferredLanguage !== undefined && { preferredLanguage: dto.preferredLanguage }),
      ...(dto.preferredMentorshipTiming !== undefined && {
        preferredMentorshipTiming: dto.preferredMentorshipTiming,
      }),
    };

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.displayName !== undefined && { displayName: dto.displayName }),
        ...(Object.keys(profileUpdate).length > 0 && {
          profile: { update: profileUpdate },
        }),
      },
      include: { profile: { include: { university: true } } },
    });
  }

  /** Admin-only search/list — deliberately excludes ADMIN-role rows from
   * results (an admin managing other admins isn't a supported flow yet, and
   * silently excluding them avoids a support/admin accidentally banning
   * themselves or a colleague from this screen). */
  async findAllAdmin(
    query: ListUsersDto,
  ): Promise<{ data: User[]; nextCursor: string | null }> {
    const take = Math.min(query.limit ?? ADMIN_DEFAULT_LIMIT, ADMIN_MAX_LIMIT);

    const where: Prisma.UserWhereInput = {
      role: query.role ?? { not: UserRole.ADMIN },
      ...(query.verificationStatus && { verificationStatus: query.verificationStatus }),
      ...(query.isBanned !== undefined && { isBanned: query.isBanned }),
      ...(query.search && {
        displayName: { contains: query.search, mode: 'insensitive' },
      }),
    };

    const rows = await this.prisma.user.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: take + 1,
      ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
    });

    const hasMore = rows.length > take;
    const data = hasMore ? rows.slice(0, take) : rows;
    const nextCursor = hasMore ? data[data.length - 1].id : null;

    return { data, nextCursor };
  }

  async setBanned(userId: string, dto: SetBannedDto): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User '${userId}' not found`);
    }
    if (user.role === UserRole.ADMIN) {
      throw new BadRequestException('Cannot ban an admin account');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { isBanned: dto.banned },
    });
  }
}
