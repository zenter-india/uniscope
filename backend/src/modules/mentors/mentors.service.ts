import { Injectable, NotFoundException } from '@nestjs/common';
import { LedgerEntryType, Prisma, SessionStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service.js';
import { AvatarService } from '../avatar/avatar.service.js';
import { ReviewsService } from '../reviews/reviews.service.js';
import { ListMentorsDto } from './dto/list-mentors.dto.js';
import {
  MentorDashboardStatsResponse,
  toMentorDashboardStatsResponse,
} from './mentor-dashboard-response.js';
import {
  MentorResponse,
  MentorTrackRecord,
  toMentorResponse,
} from './mentor-response.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

/** A "mentor" is any user with role MENTOR — identity verification is
 * deliberately NOT a discovery gate. A mentor is visible and chat-reachable
 * the moment they sign up; verification only unlocks the "accepting calls"
 * toggle (UsersService.updateProfile refuses to flip isMentorAvailable to
 * true for an unverified mentor), so calls/monetization stay gated on it
 * without blocking the free, low-friction chat path. `isMentorAvailable`
 * itself never hides a mentor from discovery either — it only controls
 * whether they can be booked for an AUDIO_CALL (see SessionsService.create).
 * An unavailable mentor still shows up everywhere, still accepts CHAT, and
 * mobile renders their status as an online/offline dot. A per-minute rate is
 * no longer a requirement: chat is free with every mentor and audio calls
 * are always billed at the flat platform rate (MENTOR_RATE_PER_MINUTE_MINOR),
 * never a mentor-set price — see product decision. */
const MENTOR_ROLES: UserRole[] = [UserRole.MENTOR];

@Injectable()
export class MentorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reviewsService: ReviewsService,
    private readonly avatarService: AvatarService,
  ) {}

  /** Avatar URLs are derived, not stored — the SVG path is fixed per
   * user and the profile's updatedAt supplies the cache-buster. */
  private avatarUrlFor(row: {
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

  /**
   * Cursor-paginated mentor discovery list. Ordered by createdAt desc with
   * id as a stable tiebreaker — replace with a rating-based sort once
   * mentor review volume is high enough to be meaningful.
   */
  async findAll(
    query: ListMentorsDto,
  ): Promise<{ data: MentorResponse[]; nextCursor: string | null }> {
    const take = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

    const where: Prisma.UserWhereInput = {
      role: { in: MENTOR_ROLES },
      isActive: true,
      isBanned: false,
      deletedAt: null,
      profile: {
        // Neither isMentorAvailable nor verificationStatus are filtered
        // here — an unverified/unavailable mentor still stays listed
        // (chat-only); only call bookings are gated on verification +
        // availability (see SessionsService.create).
        ...(query.universityId && { universityId: query.universityId }),
        ...(query.specialty && {
          specialty: { contains: query.specialty, mode: 'insensitive' },
        }),
        ...(query.stream && {
          stream: { equals: query.stream, mode: 'insensitive' },
        }),
        ...(query.language && { languages: { has: query.language } }),
      },
      ...(query.search && {
        OR: [
          { displayName: { contains: query.search, mode: 'insensitive' } },
          {
            profile: {
              is: { bio: { contains: query.search, mode: 'insensitive' } },
            },
          },
        ],
      }),
    };

    const rows = await this.prisma.user.findMany({
      where,
      include: { profile: { include: { university: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: take + 1,
      ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
    });

    const hasMore = rows.length > take;
    const rowsPage = hasMore ? rows.slice(0, take) : rows;
    const ratings = await this.reviewsService.ratingSummaries(rowsPage.map((r) => r.id));
    const data = rowsPage.map((row) =>
      toMentorResponse(row, ratings.get(row.id), undefined, this.avatarUrlFor(row)),
    );
    const nextCursor = hasMore ? rowsPage[rowsPage.length - 1].id : null;

    return { data, nextCursor };
  }

  async findById(id: string): Promise<MentorResponse> {
    const user = await this.prisma.user.findFirst({
      where: {
        id,
        role: { in: MENTOR_ROLES },
        isActive: true,
        isBanned: false,
        deletedAt: null,
      },
      include: { profile: { include: { university: true } } },
    });

    if (!user) {
      throw new NotFoundException(`Mentor '${id}' not found`);
    }

    const [rating, trackRecord] = await Promise.all([
      this.reviewsService.ratingSummary(id),
      this.trackRecord(id),
    ]);
    return toMentorResponse(user, rating, trackRecord, this.avatarUrlFor(user));
  }

  /** Public track record, derived entirely from COMPLETED sessions:
   * distinct aspirants served and total minutes actually billed. Both are
   * real aggregates — there is no response-rate or response-time stat
   * because nothing in the schema timestamps individual messages. */
  private async trackRecord(mentorId: string): Promise<MentorTrackRecord> {
    const where = {
      mentorId,
      status: SessionStatus.COMPLETED,
    } satisfies Prisma.SessionWhereInput;

    const [distinctAspirants, minutes] = await Promise.all([
      this.prisma.session.findMany({
        where,
        distinct: ['aspirantId'],
        select: { aspirantId: true },
      }),
      this.prisma.session.aggregate({
        where,
        _sum: { billedMinutes: true },
      }),
    ]);

    return {
      studentsHelped: distinctAspirants.length,
      minutesMentored: minutes._sum.billedMinutes ?? 0,
    };
  }

  /** Dashboard stats for the logged-in mentor — see mentor-dashboard-response.ts. */
  async getDashboardStats(mentorId: string): Promise<MentorDashboardStatsResponse> {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [
      todaysSessions,
      weeklyEarnings,
      monthlyEarnings,
      totalStats,
      rating,
      recentSessionRows,
    ] = await Promise.all([
      this.prisma.session.findMany({
        where: {
          mentorId,
          status: SessionStatus.COMPLETED,
          startedAt: { gte: startOfToday },
        },
        select: { billedMinutes: true },
      }),
      this.prisma.ledgerEntry.aggregate({
        where: {
          type: LedgerEntryType.SESSION_CREDIT,
          createdAt: { gte: startOfWeek },
          wallet: { userId: mentorId },
        },
        _sum: { amountMinor: true },
      }),
      this.prisma.ledgerEntry.aggregate({
        where: {
          type: LedgerEntryType.SESSION_CREDIT,
          createdAt: { gte: startOfMonth },
          wallet: { userId: mentorId },
        },
        _sum: { amountMinor: true },
      }),
      this.prisma.session.aggregate({
        where: { mentorId, status: SessionStatus.COMPLETED },
        _count: true,
        _sum: { billedMinutes: true },
      }),
      this.reviewsService.ratingSummary(mentorId),
      this.prisma.session.findMany({
        where: { mentorId, status: SessionStatus.COMPLETED },
        orderBy: { endedAt: 'desc' },
        take: 5,
        include: {
          aspirant: { select: { displayName: true } },
          ledgerEntries: {
            where: { type: LedgerEntryType.SESSION_CREDIT },
            select: { amountMinor: true },
          },
        },
      }),
    ]);

    return toMentorDashboardStatsResponse({
      todaysSessionsCount: todaysSessions.length,
      monthlyEarningsMinor: monthlyEarnings._sum.amountMinor ?? 0,
      totalSessionsCount: totalStats._count,
      totalMinutesConsulted: totalStats._sum.billedMinutes ?? 0,
      minutesConsultedToday: todaysSessions.reduce((sum, s) => sum + s.billedMinutes, 0),
      weeklyEarningsMinor: weeklyEarnings._sum.amountMinor ?? 0,
      rating,
      recentSessions: recentSessionRows.map((row) => ({
        id: row.id,
        aspirantDisplayName: row.aspirant.displayName,
        endedAt: row.endedAt,
        billedMinutes: row.billedMinutes,
        earnedMinor: row.ledgerEntries.reduce((sum, e) => sum + e.amountMinor, 0),
      })),
    });
  }
}
