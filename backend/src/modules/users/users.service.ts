import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  ReportTargetType,
  User,
  UserRole,
  VerificationStatus,
} from '@prisma/client';
import { generatePseudonym } from '../../common/helpers/pseudonym.helper.js';
import { encryptRealName } from '../../common/helpers/profile-encryption.helper.js';
import { PrismaService } from '../../database/prisma/prisma.service.js';
import { AvatarConfig } from '../avatar/avatar.constants.js';
import { AvatarService } from '../avatar/avatar.service.js';
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

/** Self-deleted accounts can be reactivated by simply logging back in, but
 * only within this window of the deletion — matches the mobile delete
 * dialog's copy. Past this, findOrCreateByPhoneHash refuses to reactivate. */
const ACCOUNT_REACTIVATION_WINDOW_DAYS = 60;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly avatarService: AvatarService,
  ) {}

  async findOrCreateByPhoneHash(
    phoneHash: string,
  ): Promise<{ user: User; isNewUser: boolean }> {
    const existing = await this.prisma.user.findUnique({
      where: { phoneHash },
    });

    if (existing?.deletedAt) {
      const daysSinceDeletion =
        (Date.now() - existing.deletedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceDeletion > ACCOUNT_REACTIVATION_WINDOW_DAYS) {
        throw new ForbiddenException(
          `This account was deleted more than ${ACCOUNT_REACTIVATION_WINDOW_DAYS} days ago and can no longer be reactivated. Contact support if you need help.`,
        );
      }
    }

    if (existing) {
      // A soft-deleted account (see deleteMe) is reactivated by its owner
      // simply proving phone ownership again via OTP, within
      // ACCOUNT_REACTIVATION_WINDOW_DAYS of deletion — matches the app's
      // existing non-destructive data model (ban/unban) rather than
      // permanently burning the phone number. Does NOT touch isBanned:
      // a banned user re-verifying OTP still gets a token here, but
      // JwtStrategy's per-request check keeps rejecting them until an
      // admin unbans, same as today.
      const reactivating = existing.deletedAt !== null;
      const updated = await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          lastActiveAt: new Date(),
          ...(reactivating && { deletedAt: null, isActive: true }),
        },
      });
      return { user: updated, isNewUser: false };
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

    await this.generateAvatarBestEffort(user.id);

    return { user, isNewUser: true };
  }

  /** Give every new user an illustrated avatar immediately, so nobody ever
   * sees a blank or initials placeholder. Deliberately non-fatal: avatar
   * rendering hits Supabase Storage, and a storage blip must never block
   * someone from signing in — they just get no avatar until they open the
   * customiser. Shared by every account-creation path (OTP signup, and
   * provisionAccountFromLead below). */
  private async generateAvatarBestEffort(userId: string): Promise<void> {
    try {
      const config = this.avatarService.randomConfig();
      await this.avatarService.renderAndStore(userId, config);
      await this.prisma.userProfile.update({
        where: { userId },
        data: { avatarKey: JSON.stringify(config) },
      });
    } catch (err) {
      // Non-fatal, but must not be invisible: a persistently failing
      // renderer would silently leave every new user without an avatar.
      this.logger.error(
        `Failed to generate avatar for new user ${userId}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  /**
   * Creates a real account from a website enrollment-lead submission (see
   * EnrollmentsService), so verifying OTP on the same phone later
   * (AuthService.verifyOtp -> findOrCreateByPhoneHash, same phoneHash
   * derivation) logs straight into an already fully set-up account instead
   * of a blank one that still needs the onboarding wizard.
   *
   * Deliberately conservative: only ever CREATES a brand-new account. If a
   * User already exists for this phoneHash — they already have a real app
   * account, or an earlier lead submission already provisioned one — this
   * is a no-op that just returns the existing user, so a web-form
   * resubmission (or someone re-registering with a phone number that's
   * already a real, possibly-since-changed account) can never clobber real
   * account data.
   */
  async provisionAccountFromLead(params: {
    phoneHash: string;
    role: UserRole;
    displayName?: string;
    realName?: string;
    profile: Prisma.UserProfileUncheckedCreateWithoutUserInput;
  }): Promise<{ user: User; isNewUser: boolean }> {
    const existing = await this.prisma.user.findUnique({
      where: { phoneHash: params.phoneHash },
    });
    if (existing) {
      return { user: existing, isNewUser: false };
    }

    const user = await this.prisma.user.create({
      data: {
        phoneHash: params.phoneHash,
        displayName: params.displayName?.trim() || generatePseudonym(),
        role: params.role,
        lastActiveAt: new Date(),
        profile: {
          create: {
            ...params.profile,
            ...(params.realName?.trim() && {
              realNameEncrypted: encryptRealName(params.realName.trim()),
            }),
          },
        },
        wallet: { create: {} },
      },
    });

    await this.generateAvatarBestEffort(user.id);

    return { user, isNewUser: true };
  }

  async findById(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: { include: { university: true } } },
    });
  }

  /** Derives the public avatar URL from a loaded user+profile row.
   * Public so controllers can decorate their response projections. */
  avatarUrlFor(row: {
    id: string;
    profile?: { avatarKey: string | null; updatedAt: Date } | null;
  }): string | null {
    if (!row.profile) return null;
    return this.avatarService.publicUrl(
      row.id,
      row.profile.avatarKey,
      row.profile.updatedAt,
    );
  }

  /** Current avatar config, or a fresh random one if the user has none
   * (e.g. signup-time rendering failed) so the customiser always opens
   * with something valid selected. */
  async getAvatarConfig(userId: string): Promise<AvatarConfig> {
    const profile = await this.prisma.userProfile.findUniqueOrThrow({
      where: { userId },
      select: { avatarKey: true },
    });
    if (!profile.avatarKey) return this.avatarService.randomConfig();
    try {
      return this.avatarService.validateConfig(JSON.parse(profile.avatarKey));
    } catch {
      // Stored config predates a catalogue change, or is corrupt — fall
      // back rather than 500 on the customiser.
      return this.avatarService.randomConfig();
    }
  }

  /** Re-renders and re-uploads, then persists the config. The stored SVG
   * path is stable per user, so the client busts its cache via the `v`
   * query param on avatarUrl (derived from profile.updatedAt). */
  async updateAvatar(userId: string, rawConfig: unknown): Promise<AvatarConfig> {
    const config = this.avatarService.validateConfig(rawConfig);
    await this.avatarService.renderAndStore(userId, config);
    await this.prisma.userProfile.update({
      where: { userId },
      data: { avatarKey: JSON.stringify(config) },
    });
    return config;
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

  /** Live check for the mentor wizard's "Alias" field — not a DB-level
   * unique constraint (displayName has none, and pseudonym generation
   * already has no collisions in practice), just a courtesy check so a
   * mentor doesn't pick a handle someone else already has. Case-insensitive
   * so "Riya_NIT" and "riya_nit" collide as expected. */
  async isDisplayNameAvailable(displayName: string, excludingUserId?: string): Promise<boolean> {
    const existing = await this.prisma.user.findFirst({
      where: {
        displayName: { equals: displayName, mode: 'insensitive' },
        ...(excludingUserId && { id: { not: excludingUserId } }),
      },
      select: { id: true },
    });
    return existing === null;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    if (dto.isMentorAvailable !== undefined) {
      const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
      if (user.role !== UserRole.MENTOR) {
        throw new BadRequestException('Only mentors can set mentoring availability');
      }
      // Identity verification is optional and never blocks a mentor from
      // being discoverable or chatted with (see MentorsService) — but
      // turning ON call bookability specifically requires it, since that's
      // the monetized, harder-to-reverse surface. Turning it off is always
      // allowed regardless of verification state.
      if (dto.isMentorAvailable && user.verificationStatus !== VerificationStatus.VERIFIED) {
        throw new BadRequestException(
          'Complete identity verification before accepting call bookings — you can still chat with aspirants in the meantime.',
        );
      }
    }

    const profileUpdate = {
      ...(dto.bio !== undefined && { bio: dto.bio }),
      ...(dto.specialty !== undefined && { specialty: dto.specialty }),
      ...(dto.languages !== undefined && { languages: dto.languages }),
      ...(dto.availableDays !== undefined && { availableDays: dto.availableDays }),
      // Re-stamp on every toggle so switching back on restarts the 24h
      // window (see isCallAvailable). Stamped on the off-flip too, purely so
      // the column always reflects the last deliberate change.
      ...(dto.isMentorAvailable !== undefined && {
        isMentorAvailable: dto.isMentorAvailable,
        availabilitySetAt: new Date(),
      }),
      ...(dto.gender !== undefined && { gender: dto.gender }),
      ...(dto.state !== undefined && { state: dto.state }),
      ...(dto.city !== undefined && { city: dto.city }),
      ...(dto.qualification !== undefined && { qualification: dto.qualification }),
      ...(dto.specialization !== undefined && { specialization: dto.specialization }),
      ...(dto.stream !== undefined && { stream: dto.stream }),
      ...(dto.goals !== undefined && { goals: dto.goals }),
      ...(dto.dateOfBirth !== undefined && { dateOfBirth: new Date(dto.dateOfBirth) }),
      ...(dto.courseInterested !== undefined && { courseInterested: dto.courseInterested }),
      ...(dto.preferredLanguage !== undefined && { preferredLanguage: dto.preferredLanguage }),
      ...(dto.preferredMentorshipTiming !== undefined && {
        preferredMentorshipTiming: dto.preferredMentorshipTiming,
      }),
      ...(dto.realName !== undefined && {
        realNameEncrypted: encryptRealName(dto.realName),
      }),
      ...(dto.yearOfStudy !== undefined && { yearOfStudy: dto.yearOfStudy }),
      ...(dto.graduationYear !== undefined && { graduationYear: dto.graduationYear }),
      ...(dto.yearInfoPrivate !== undefined && { yearInfoPrivate: dto.yearInfoPrivate }),
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

  /** Admin-only full detail for one user — every onboarding field, decrypted
   * real name, wallet balance, verification history and activity counters.
   * Returns the raw row + counters; the controller projects it via
   * {@link toAdminUserDetail}. */
  async findDetailAdmin(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: { include: { university: true } },
        wallet: true,
        verificationRequests: {
          orderBy: { createdAt: 'desc' },
          include: {
            university: { select: { name: true } },
            reviewer: { select: { displayName: true } },
          },
        },
      },
    });
    if (!user) {
      throw new NotFoundException(`User '${userId}' not found`);
    }

    const [
      sessionsAsAspirant,
      sessionsAsMentor,
      reportsFiled,
      reportsAgainst,
      mentorReviewsReceived,
      universityReviewsWritten,
    ] = await Promise.all([
      this.prisma.session.count({ where: { aspirantId: userId } }),
      this.prisma.session.count({ where: { mentorId: userId } }),
      this.prisma.report.count({ where: { reporterId: userId } }),
      this.prisma.report.count({
        where: { targetType: ReportTargetType.USER, targetId: userId },
      }),
      this.prisma.mentorReview.count({ where: { mentorId: userId } }),
      this.prisma.review.count({ where: { authorId: userId } }),
    ]);

    return {
      user,
      activity: {
        sessionsAsAspirant,
        sessionsAsMentor,
        reportsFiled,
        reportsAgainst,
        mentorReviewsReceived,
        universityReviewsWritten,
      },
    };
  }

  /**
   * Self-service account deletion. Soft-delete only, matching the rest of
   * the app's non-destructive data model (see ban/deactivate patterns) —
   * sets deletedAt + isActive false and clears the refresh token so the
   * next `/auth/token/refresh` fails immediately; JwtStrategy.validate
   * already rejects any still-live access token for a deletedAt user on
   * its next request. Historical session/ledger rows are intentionally
   * kept for accounting/legal retention, per the privacy policy.
   */
  async deleteMe(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        isActive: false,
        deletedAt: new Date(),
        refreshTokenHash: null,
      },
    });
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
