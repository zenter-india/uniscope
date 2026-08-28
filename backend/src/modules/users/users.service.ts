import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, User, UserRole, VerificationStatus } from '@prisma/client';
import { generatePseudonym } from '../../common/helpers/pseudonym.helper.js';
import { encryptRealName } from '../../common/helpers/profile-encryption.helper.js';
import { buildUniqueId, streamCodeFor } from '../../common/helpers/unique-id.helper.js';
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

    const user = await this.createUserWithUniquePseudonym(phoneHash);

    // Give every new user an illustrated avatar immediately, so nobody
    // ever sees a blank or initials placeholder. Deliberately non-fatal:
    // avatar rendering hits Supabase Storage, and a storage blip must
    // never block someone from signing in. They just get no avatar until
    // they open the customiser.
    try {
      const config = this.avatarService.randomConfig();
      await this.avatarService.renderAndStore(user.id, config);
      await this.prisma.userProfile.update({
        where: { userId: user.id },
        data: { avatarKey: JSON.stringify(config) },
      });
    } catch (err) {
      // Non-fatal, but must not be invisible: a persistently failing
      // renderer would silently leave every new user without an avatar.
      this.logger.error(
        `Failed to generate avatar for new user ${user.id}`,
        err instanceof Error ? err.stack : String(err),
      );
    }

    return { user, isNewUser: true };
  }

  async findById(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: { include: { university: true } } },
    });
  }

  /** Assigns User.uniqueId the first time it's needed — called from the
   * self-service GET/PATCH /users/me paths only (never for viewing someone
   * else's profile), so this write side effect is confined to a user acting
   * on their own account. A no-op once uniqueId is already set, so it's
   * safe to call on every request. Requires profile.stream to be known;
   * returns the user unchanged (uniqueId still null) if it isn't yet —
   * the aspirant/mentor onboarding wizard always sets stream, so this
   * resolves itself the moment onboarding completes.
   *
   * The sequence number is claimed with a single atomic
   * INSERT ... ON CONFLICT DO UPDATE ... RETURNING against
   * IdSequenceCounter, so two concurrent requests (extremely unlikely for
   * the same user, but cheap to guard) can never be handed the same
   * number. */
  async ensureUniqueId(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: { include: { university: true } } },
    });
    // Matches findById's contract (null, not a throw) so callers like
    // UsersController.getMe can turn a missing user into a clean 404.
    if (!user) return null;
    if (user.uniqueId || !user.profile?.stream || user.role === UserRole.ADMIN) {
      return user;
    }

    const prefix = user.role === UserRole.MENTOR ? 'M' : 'A';
    const streamCode = streamCodeFor(user.profile.stream);
    const bucketKey = `${prefix}${streamCode}`;

    const rows = await this.prisma.$queryRaw<{ assigned: number }[]>`
      INSERT INTO id_sequence_counters (bucket_key, next_value)
      VALUES (${bucketKey}, 2)
      ON CONFLICT (bucket_key)
      DO UPDATE SET next_value = id_sequence_counters.next_value + 1
      RETURNING next_value - 1 AS assigned
    `;
    const uniqueId = buildUniqueId(prefix, streamCode, rows[0].assigned);

    try {
      return await this.prisma.user.update({
        where: { id: userId },
        data: { uniqueId },
        include: { profile: { include: { university: true } } },
      });
    } catch (err) {
      // The counter is atomic, so a real collision here would mean a
      // uniqueId got hand-edited outside this code path — vanishingly
      // unlikely. Don't fail the profile read/update over it; the user
      // just tries again on their next request.
      if (this.isUniqueConstraintViolation(err)) return user;
      throw err;
    }
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

  /** Live check for the mentor wizard's "Alias" field as the user types.
   * Backed by a real DB-level constraint now (a case-insensitive unique
   * index on lower(display_name) — see the
   * unique_display_name_case_insensitive migration), so this is a fast
   * pre-check for UX only; the actual guarantee is enforced at save time
   * in updateProfile via the DB constraint + a friendly ConflictException
   * on P2002. Case-insensitive so "Riya_NIT" and "riya_nit" collide. */
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

  /** Every new user gets an auto-generated pseudonym (see
   * pseudonym.helper.ts) — collisions are now rejected at the DB level
   * (case-insensitive unique index), so retry with a freshly rolled name
   * on the rare P2002 instead of letting signup fail outright. */
  private async createUserWithUniquePseudonym(phoneHash: string, attempt = 0): Promise<User> {
    try {
      return await this.prisma.user.create({
        data: {
          phoneHash,
          displayName: generatePseudonym(),
          role: UserRole.ASPIRANT,
          lastActiveAt: new Date(),
          profile: { create: {} },
          wallet: { create: {} },
        },
      });
    } catch (err) {
      if (this.isUniqueConstraintViolation(err) && attempt < 5) {
        return this.createUserWithUniquePseudonym(phoneHash, attempt + 1);
      }
      throw err;
    }
  }

  private isUniqueConstraintViolation(err: unknown): boolean {
    return (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: unknown }).code === 'P2002'
    );
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

    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          ...(dto.displayName !== undefined && { displayName: dto.displayName }),
          ...(Object.keys(profileUpdate).length > 0 && {
            profile: { update: profileUpdate },
          }),
        },
      });
    } catch (err) {
      // The live check-display-name call the wizard makes as you type is
      // only a UX hint — this is the actual guarantee (DB-level, so a race
      // between two people checking the same free name at once still can't
      // let both through).
      if (dto.displayName !== undefined && this.isUniqueConstraintViolation(err)) {
        throw new ConflictException('That name is already taken — try another.');
      }
      throw err;
    }

    // If this update is what just set profile.stream (e.g. onboarding's
    // final step, or an EditProfileScreen change), this is also the
    // moment uniqueId first becomes assignable — no separate trigger
    // needed, ensureUniqueId is a no-op once already assigned. The row we
    // just updated above always exists, so a null here would mean it was
    // deleted in the instant between that update and this read.
    const updated = await this.ensureUniqueId(userId);
    if (!updated) {
      throw new NotFoundException('User not found');
    }
    return updated;
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
