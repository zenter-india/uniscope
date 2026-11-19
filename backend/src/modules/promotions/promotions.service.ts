import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { LedgerEntryType, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import {
  UNIMINUTE_VALUE_MINOR,
  WalletService,
} from '../wallet/wallet.service.js';
import { CreatePromotionDto } from './dto/create-promotion.dto.js';

/** 1 rupee in the wallet's minor units (paise). A Uniminute is worth 10
 * rupees = UNIMINUTE_VALUE_MINOR minor units. */
export const MINOR_PER_RUPEE = 100;

/** Crediting many wallets is done inside the request, a few at a time. Above
 * this many recipients a credited promotion is refused rather than risk a
 * request that times out half way (message-only promotions have no limit). */
export const MAX_CREDITED_RECIPIENTS = 5000;
const CREDIT_CONCURRENCY = 10;

/** A user who installs the app long after a promotion went out should not be
 * greeted by a stale popup. */
export const POPUP_MAX_AGE_DAYS = 30;
const POPUP_MAX_PER_OPEN = 5;

export interface PromotionResponse {
  id: string;
  title: string;
  body: string | null;
  audience: string;
  linkUrl: string | null;
  linkLabel: string | null;
  aspirantCreditMinor: number;
  mentorCreditMinor: number;
  recipientCount: number;
  creditedCount: number;
  /** How many recipients have been shown the popup so far. */
  seenCount: number;
  createdAt: string;
}

/** How many recipients one history lookup returns at most. */
export const MAX_LISTED_RECIPIENTS = 1000;

export interface PromotionRecipientRow {
  userId: string;
  displayName: string;
  role: string | null;
  uniqueId: string | null;
  /** What was credited to this person's wallet, in minor units (0 = nothing). */
  creditedMinor: number;
  /** When the popup was shown to them; null = not opened the app since. */
  seenAt: string | null;
}

export interface PromotionRecipientsResponse {
  total: number;
  /** True when `total` is larger than the list returned. */
  truncated: boolean;
  recipients: PromotionRecipientRow[];
}

/** What the app shows in the popup. */
export interface PendingPromotion {
  id: string;
  title: string;
  body: string | null;
  linkUrl: string | null;
  linkLabel: string | null;
  /** What was credited to THIS user's wallet, in minor units (0 = nothing). */
  creditedMinor: number;
  createdAt: string;
}

interface PromotionRow {
  id: string;
  title: string;
  body: string | null;
  audience: string;
  linkUrl: string | null;
  linkLabel: string | null;
  aspirantCreditMinor: number;
  mentorCreditMinor: number;
  recipientCount: number;
  creditedCount: number;
  createdAt: Date;
}

function toResponse(row: PromotionRow, seenCount: number): PromotionResponse {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    audience: row.audience,
    linkUrl: row.linkUrl,
    linkLabel: row.linkLabel,
    aspirantCreditMinor: row.aspirantCreditMinor,
    mentorCreditMinor: row.mentorCreditMinor,
    recipientCount: row.recipientCount,
    creditedCount: row.creditedCount,
    seenCount,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Runs `fn` over `items`, at most `limit` at a time. */
async function inBatches<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  for (let i = 0; i < items.length; i += limit) {
    await Promise.all(items.slice(i, i + limit).map(fn));
  }
}

@Injectable()
export class PromotionsService {
  private readonly logger = new Logger(PromotionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly wallet: WalletService,
  ) {}

  /** Who a promotion to `audience` reaches. ADMIN accounts are never
   * included, and neither are banned, deactivated or deleted accounts. For
   * SELECTED the explicit `userIds` are narrowed to those same eligible
   * accounts, so a stray id can never pull in someone who shouldn't get it. */
  private recipientWhere(
    audience: string,
    userIds: readonly string[] = [],
  ): Prisma.UserWhereInput {
    const base: Prisma.UserWhereInput = {
      isActive: true,
      isBanned: false,
      deletedAt: null,
    };
    if (audience === 'ASPIRANT') return { ...base, role: UserRole.ASPIRANT };
    if (audience === 'MENTOR') return { ...base, role: UserRole.MENTOR };
    const people = {
      ...base,
      role: { in: [UserRole.ASPIRANT, UserRole.MENTOR] },
    };
    if (audience === 'SELECTED') return { ...people, id: { in: [...userIds] } };
    return people;
  }

  /** "This will reach N people" for the form, split by role so the
   * confirmation can state exactly how much money a credit adds up to. */
  async previewCount(
    audience: string,
    userIds: readonly string[] = [],
  ): Promise<{
    recipientCount: number;
    aspirantCount: number;
    mentorCount: number;
  }> {
    const rows = await this.prisma.user.groupBy({
      by: ['role'],
      where: this.recipientWhere(audience, userIds),
      _count: { _all: true },
    });
    const countOf = (role: UserRole) =>
      rows.find((r) => r.role === role)?._count._all ?? 0;
    const aspirantCount = countOf(UserRole.ASPIRANT);
    const mentorCount = countOf(UserRole.MENTOR);
    return {
      recipientCount: aspirantCount + mentorCount,
      aspirantCount,
      mentorCount,
    };
  }

  async create(
    dto: CreatePromotionDto,
    adminUserId: string,
  ): Promise<PromotionResponse> {
    const title = dto.title.trim();
    const body = dto.body?.trim() || null;
    const linkUrl = dto.linkUrl?.trim() || null;
    // A label with no link is meaningless; a link with no label gets a default.
    const linkLabel = linkUrl ? dto.linkLabel?.trim() || 'Open' : null;

    const userIds = dto.audience === 'SELECTED' ? (dto.userIds ?? []) : [];
    if (dto.audience === 'SELECTED' && userIds.length === 0) {
      throw new BadRequestException('Pick at least one user to send to.');
    }

    const aspirantCreditMinor =
      (dto.aspirantUniminutes ?? 0) * UNIMINUTE_VALUE_MINOR;
    const mentorCreditMinor = (dto.mentorRupees ?? 0) * MINOR_PER_RUPEE;

    // Refuse a credit for a kind of user the audience doesn't contain: it
    // would silently do nothing, which is a worse surprise than an error.
    if (aspirantCreditMinor > 0 && dto.audience === 'MENTOR') {
      throw new BadRequestException(
        'A Uniminutes credit is for students, but this promotion is for mentors only.',
      );
    }
    if (mentorCreditMinor > 0 && dto.audience === 'ASPIRANT') {
      throw new BadRequestException(
        'A rupee credit is for mentors, but this promotion is for students only.',
      );
    }

    const recipients = await this.prisma.user.findMany({
      where: this.recipientWhere(dto.audience, userIds),
      select: { id: true, role: true },
    });
    if (recipients.length === 0) {
      throw new BadRequestException(
        'No eligible recipients for this promotion.',
      );
    }

    const credits = (role: UserRole): number =>
      role === UserRole.ASPIRANT ? aspirantCreditMinor : mentorCreditMinor;
    const anyCredit = aspirantCreditMinor > 0 || mentorCreditMinor > 0;
    if (anyCredit && recipients.length > MAX_CREDITED_RECIPIENTS) {
      throw new BadRequestException(
        `A promotion with a credit can reach at most ${MAX_CREDITED_RECIPIENTS} people at once; this one reaches ${recipients.length}. Send it in smaller groups.`,
      );
    }

    const promotion = await this.prisma.$transaction(async (tx) => {
      const created = await tx.promotion.create({
        data: {
          title,
          body,
          audience: dto.audience,
          linkUrl,
          linkLabel,
          aspirantCreditMinor,
          mentorCreditMinor,
          recipientCount: recipients.length,
          sentBy: adminUserId,
        },
      });
      await tx.promotionRecipient.createMany({
        data: recipients.map((r) => ({
          promotionId: created.id,
          userId: r.id,
        })),
        skipDuplicates: true,
      });
      return created;
    });

    const creditedCount = anyCredit
      ? await this.creditRecipients(promotion.id, title, recipients, credits)
      : 0;

    // The usual in-app notification + push, with the popup's link in the
    // metadata so a tap can reach it too.
    await this.notifications.sendBulk(
      recipients.map((r) => r.id),
      {
        type: 'SYSTEM',
        title,
        body: body ?? undefined,
        metadata: {
          promotion: 'true',
          promotionId: promotion.id,
          ...(linkUrl ? { linkUrl } : {}),
        },
      },
    );

    const row = creditedCount
      ? await this.prisma.promotion.update({
          where: { id: promotion.id },
          data: { creditedCount },
        })
      : promotion;
    return toResponse(row, 0);
  }

  /** Credits each recipient's wallet. The ledger key is per promotion and
   * per user, so a retry (or two requests racing) can never credit the same
   * person twice: the second attempt is a safe no-op. A recipient with no
   * wallet, or whose credit fails, is logged and skipped -- the others still
   * get theirs. Returns how many wallets were credited. */
  private async creditRecipients(
    promotionId: string,
    title: string,
    recipients: { id: string; role: UserRole }[],
    creditFor: (role: UserRole) => number,
  ): Promise<number> {
    const due = recipients.filter((r) => creditFor(r.role) > 0);
    const wallets = await this.prisma.wallet.findMany({
      where: { userId: { in: due.map((r) => r.id) } },
      select: { id: true, userId: true },
    });
    const walletByUser = new Map(wallets.map((w) => [w.userId, w.id]));

    let credited = 0;
    await inBatches(due, CREDIT_CONCURRENCY, async (r) => {
      const walletId = walletByUser.get(r.id);
      if (!walletId) {
        this.logger.warn(
          `promotion ${promotionId}: user ${r.id} has no wallet`,
        );
        return;
      }
      const amountMinor = creditFor(r.role);
      try {
        const applied = await this.wallet.applyLedgerEntry({
          walletId,
          type: LedgerEntryType.ADJUSTMENT,
          amountMinor,
          idempotencyKey: `promotion:${promotionId}:${r.id}`,
          note: `Promotion — ${title}`.slice(0, 300),
        });
        if (!applied) return; // already credited by an earlier attempt
        await this.prisma.promotionRecipient.update({
          where: { promotionId_userId: { promotionId, userId: r.id } },
          data: { creditedMinor: amountMinor },
        });
        credited += 1;
      } catch (err) {
        this.logger.error(
          `promotion ${promotionId}: crediting user ${r.id} failed: ${String(err)}`,
        );
      }
    });
    return credited;
  }

  async list(): Promise<PromotionResponse[]> {
    const rows = await this.prisma.promotion.findMany({
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    if (rows.length === 0) return [];
    const seen = await this.prisma.promotionRecipient.groupBy({
      by: ['promotionId'],
      where: {
        promotionId: { in: rows.map((r) => r.id) },
        seenAt: { not: null },
      },
      _count: { _all: true },
    });
    const seenById = new Map(seen.map((s) => [s.promotionId, s._count._all]));
    return rows.map((r) => toResponse(r, seenById.get(r.id) ?? 0));
  }

  /** Who one promotion was sent to, for the admin's history: name, public ID,
   * role, what each was credited and whether they have seen the popup yet.
   * Capped, so an "everyone" promotion can't return an enormous list; `total`
   * is the real number of recipients. Names are looked up separately because a
   * recipient row only stores the user id. */
  async recipientsOf(promotionId: string): Promise<PromotionRecipientsResponse> {
    const promotion = await this.prisma.promotion.findUnique({
      where: { id: promotionId },
      select: { id: true },
    });
    if (!promotion) throw new NotFoundException('Promotion not found');

    const [rows, total] = await Promise.all([
      this.prisma.promotionRecipient.findMany({
        where: { promotionId },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: MAX_LISTED_RECIPIENTS,
        select: { userId: true, creditedMinor: true, seenAt: true },
      }),
      this.prisma.promotionRecipient.count({ where: { promotionId } }),
    ]);
    const users = await this.prisma.user.findMany({
      where: { id: { in: rows.map((r) => r.userId) } },
      select: { id: true, displayName: true, role: true, uniqueId: true },
    });
    const userById = new Map(users.map((u) => [u.id, u]));

    return {
      total,
      truncated: total > rows.length,
      recipients: rows.map((r) => {
        const u = userById.get(r.userId);
        return {
          userId: r.userId,
          displayName: u?.displayName ?? 'Deleted user',
          role: u?.role ?? null,
          uniqueId: u?.uniqueId ?? null,
          creditedMinor: r.creditedMinor,
          seenAt: r.seenAt ? r.seenAt.toISOString() : null,
        };
      }),
    };
  }

  // ── what the app sees ────────────────────────────────────────────────────

  /** Promotions this user hasn't been shown yet, newest first. */
  async pendingFor(userId: string): Promise<PendingPromotion[]> {
    const since = new Date(
      Date.now() - POPUP_MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
    );
    const rows = await this.prisma.promotionRecipient.findMany({
      where: {
        userId,
        seenAt: null,
        promotion: { createdAt: { gte: since } },
      },
      include: { promotion: true },
      orderBy: { createdAt: 'desc' },
      take: POPUP_MAX_PER_OPEN,
    });
    return rows.map((r) => ({
      id: r.promotion.id,
      title: r.promotion.title,
      body: r.promotion.body,
      linkUrl: r.promotion.linkUrl,
      linkLabel: r.promotion.linkLabel,
      creditedMinor: r.creditedMinor,
      createdAt: r.promotion.createdAt.toISOString(),
    }));
  }

  /** Marks the popup as shown so it never comes back. 404 (not 403) when this
   * user was never a recipient, like everywhere else in the API. */
  async markSeen(userId: string, promotionId: string): Promise<void> {
    const row = await this.prisma.promotionRecipient.findUnique({
      where: { promotionId_userId: { promotionId, userId } },
      select: { seenAt: true },
    });
    if (!row) throw new NotFoundException('Promotion not found');
    if (row.seenAt) return;
    await this.prisma.promotionRecipient.updateMany({
      where: { promotionId, userId, seenAt: null },
      data: { seenAt: new Date() },
    });
  }
}
