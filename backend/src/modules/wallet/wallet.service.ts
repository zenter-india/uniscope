import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HoldStatus, LedgerEntryType, Prisma } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'crypto';
import Razorpay from 'razorpay';
import type { RazorpayConfig } from '../../config/index.js';
import { PrismaService } from '../../database/prisma/prisma.service.js';
import { CreateTopupDto } from './dto/create-topup.dto.js';
import { ListLedgerDto } from './dto/list-ledger.dto.js';
import { VerifyTopupDto } from './dto/verify-topup.dto.js';
import {
  LedgerEntryResponse,
  WalletResponse,
  toLedgerEntryResponse,
  toWalletResponse,
} from './wallet-response.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const CURRENCY = 'INR';

/**
 * Uniminute economics (product decision, see docs/decisions):
 *   - 1 Uniminute = 1000 minor units (₹10) — matches the flat mentor call
 *     payout rate exactly, so a session debit of N Uniminutes always pays
 *     the mentor N * MENTOR_RATE_PER_MINUTE_MINOR with zero per-session
 *     platform cut.
 *   - The platform margin lives ONLY in the recharge conversion: a ₹250
 *     (25,000 minor) topup credits 20 Uniminutes (20,000 minor) — a fixed
 *     1250-minor-paid-per-Uniminute-credited rate, i.e. 20% margin. This is
 *     never shown to the user as a "commission" line; the wallet is simply
 *     denominated in Uniminutes, not rupees, so there's no rupee-for-rupee
 *     promise being broken. The raw paid amount is preserved in the ledger
 *     entry's `note` for internal audit/revenue reporting.
 */
export const UNIMINUTE_VALUE_MINOR = 1000;
const PAID_MINOR_PER_UNIMINUTE_CREDITED = 1250;
export const MENTOR_RATE_PER_MINUTE_MINOR = UNIMINUTE_VALUE_MINOR;

function computeTopupCredit(paidAmountMinor: number): {
  uniminutes: number;
  creditedAmountMinor: number;
} {
  const uniminutes = Math.floor(paidAmountMinor / PAID_MINOR_PER_UNIMINUTE_CREDITED);
  return { uniminutes, creditedAmountMinor: uniminutes * UNIMINUTE_VALUE_MINOR };
}

/**
 * WalletService is the ONLY place that writes to the ledger. Every write
 * goes through applyLedgerEntry, which enforces the invariants from the
 * architecture review in one atomic DB transaction:
 *   1. balanceMinor is incremented with a single atomic UPDATE (Postgres
 *      row-level locking makes concurrent increments safe without a
 *      separate SELECT ... FOR UPDATE).
 *   2. The ledger row's balanceAfterMinor is the value that UPDATE
 *      returned — never a value computed from a stale read.
 *   3. idempotencyKey has a unique DB constraint. A duplicate key throws
 *      P2002, the whole transaction (including the balance increment)
 *      rolls back, and the caller treats it as "already applied" — this is
 *      what makes retried Razorpay webhooks and retried billing ticks safe.
 * Session billing (holds, per-minute debits, credits, refunds) will call
 * this same method once the LiveKit/BullMQ billing clock is wired in —
 * deliberately not duplicating this logic elsewhere.
 */
@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);
  private readonly razorpay: Razorpay;
  private readonly cfg: RazorpayConfig;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.cfg = this.config.get<RazorpayConfig>('razorpay')!;
    this.razorpay = new Razorpay({
      key_id: this.cfg.keyId,
      key_secret: this.cfg.keySecret,
    });
  }

  async getBalance(userId: string): Promise<WalletResponse> {
    const wallet = await this.requireWallet(userId);
    return toWalletResponse(wallet);
  }

  async getLedger(
    userId: string,
    query: ListLedgerDto,
  ): Promise<{ data: LedgerEntryResponse[]; nextCursor: string | null }> {
    const wallet = await this.requireWallet(userId);
    const take = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

    const rows = await this.prisma.ledgerEntry.findMany({
      where: { walletId: wallet.id },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: take + 1,
      ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
    });

    const hasMore = rows.length > take;
    const rowsPage = hasMore ? rows.slice(0, take) : rows;
    const data = rowsPage.map(toLedgerEntryResponse);
    const nextCursor = hasMore ? rowsPage[rowsPage.length - 1].id : null;

    return { data, nextCursor };
  }

  /**
   * Creates a Razorpay Order for the requested amount. The order carries
   * the userId in `notes` so the webhook — which has no session/JWT context
   * — knows whose wallet to credit. No ledger entry is written here; only
   * a confirmed `payment.captured` webhook credits the wallet.
   */
  async createTopupOrder(
    userId: string,
    dto: CreateTopupDto,
  ): Promise<{ orderId: string; amountMinor: number; currency: string; keyId: string }> {
    const order = await this.razorpay.orders.create({
      amount: dto.amountMinor,
      currency: CURRENCY,
      notes: { userId },
    });

    return {
      orderId: order.id,
      amountMinor: dto.amountMinor,
      currency: CURRENCY,
      keyId: this.cfg.keyId,
    };
  }

  /**
   * Direct client-confirmation path (Razorpay Checkout's success callback),
   * for environments where the webhook URL isn't publicly reachable (e.g.
   * local dev). Verifies the order_id|payment_id signature against
   * key_secret — the standard Razorpay direct-integration pattern — then
   * credits via the SAME idempotencyKey the webhook handler would use, so
   * whichever path fires first wins and the other is a safe no-op.
   */
  async verifyAndCreditTopup(userId: string, dto: VerifyTopupDto): Promise<WalletResponse> {
    const expectedSignature = createHmac('sha256', this.cfg.keySecret)
      .update(`${dto.razorpayOrderId}|${dto.razorpayPaymentId}`)
      .digest('hex');
    const expectedBuf = Buffer.from(expectedSignature, 'utf8');
    const actualBuf = Buffer.from(dto.razorpaySignature, 'utf8');
    const validSignature =
      expectedBuf.length === actualBuf.length && timingSafeEqual(expectedBuf, actualBuf);
    if (!validSignature) {
      throw new BadRequestException('Invalid payment signature');
    }

    const order = await this.razorpay.orders.fetch(dto.razorpayOrderId);
    const orderUserId = (order.notes as Record<string, string> | undefined)?.['userId'];
    if (orderUserId !== userId) {
      throw new ForbiddenException('This order does not belong to the current user');
    }

    const wallet = await this.requireWallet(userId);
    const paidAmountMinor = Number(order.amount);
    const { uniminutes, creditedAmountMinor } = computeTopupCredit(paidAmountMinor);
    await this.applyLedgerEntry({
      walletId: wallet.id,
      type: LedgerEntryType.TOPUP,
      amountMinor: creditedAmountMinor,
      idempotencyKey: `razorpay:${dto.razorpayPaymentId}`,
      note: `Razorpay order ${dto.razorpayOrderId} — paid ${paidAmountMinor} minor, credited ${uniminutes} Uniminutes`,
    });

    return toWalletResponse(await this.requireWallet(userId));
  }

  /**
   * Verifies the Razorpay webhook signature against the RAW request body —
   * must run before any payload field is trusted. Returns false (never
   * throws) on mismatch so the controller can respond generically.
   */
  verifyWebhookSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
    if (!signatureHeader) return false;
    const expected = createHmac('sha256', this.cfg.webhookSecret)
      .update(rawBody)
      .digest('hex');
    const expectedBuf = Buffer.from(expected, 'utf8');
    const actualBuf = Buffer.from(signatureHeader, 'utf8');
    if (expectedBuf.length !== actualBuf.length) return false;
    return timingSafeEqual(expectedBuf, actualBuf);
  }

  /**
   * Handles a verified `payment.captured` webhook event: fetches the order
   * (source of truth for the userId, rather than trusting notes echoed back
   * in the payment payload) and credits the wallet exactly once.
   */
  async handleTopupCaptured(event: {
    payload: {
      payment: {
        entity: { id: string; order_id: string; amount: number };
      };
    };
  }): Promise<void> {
    const payment = event.payload.payment.entity;
    const order = await this.razorpay.orders.fetch(payment.order_id);
    const userId = (order.notes as Record<string, string> | undefined)?.['userId'];

    if (!userId) {
      this.logger.error(
        `Razorpay order ${payment.order_id} has no userId in notes — cannot credit wallet`,
      );
      return;
    }

    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      this.logger.error(`No wallet found for user ${userId} (order ${payment.order_id})`);
      return;
    }

    const { uniminutes, creditedAmountMinor } = computeTopupCredit(payment.amount);
    const applied = await this.applyLedgerEntry({
      walletId: wallet.id,
      type: LedgerEntryType.TOPUP,
      amountMinor: creditedAmountMinor,
      idempotencyKey: `razorpay:${payment.id}`,
      note: `Razorpay order ${payment.order_id} — paid ${payment.amount} minor, credited ${uniminutes} Uniminutes`,
    });

    if (!applied) {
      this.logger.log(`Payment ${payment.id} already processed — webhook retry, no-op`);
    }
  }

  /**
   * The single, atomic, idempotent ledger write. `amountMinor` is signed
   * (positive = credit, negative = debit) per the schema's LedgerEntry
   * convention. Returns false if idempotencyKey was already used (safe
   * no-op on retry) rather than throwing, so callers can log-and-continue.
   */
  async applyLedgerEntry(params: {
    walletId: string;
    type: LedgerEntryType;
    amountMinor: number;
    idempotencyKey: string;
    sessionId?: string;
    note?: string;
  }): Promise<boolean> {
    try {
      await this.prisma.$transaction(async (tx) => {
        const [row] = await tx.$queryRaw<{ balance_minor: number }[]>(
          Prisma.sql`UPDATE wallets SET balance_minor = balance_minor + ${params.amountMinor}, updated_at = now() WHERE id = ${params.walletId} RETURNING balance_minor`,
        );
        if (!row) {
          throw new NotFoundException(`Wallet '${params.walletId}' not found`);
        }

        await tx.ledgerEntry.create({
          data: {
            walletId: params.walletId,
            type: params.type,
            amountMinor: params.amountMinor,
            balanceAfterMinor: row.balance_minor,
            sessionId: params.sessionId,
            idempotencyKey: params.idempotencyKey,
            note: params.note,
          },
        });
      });
      return true;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return false; // idempotency key already used — safe no-op
      }
      throw err;
    }
  }

  /**
   * Spendable balance minus every currently ACTIVE hold — this, not raw
   * balanceMinor, is what booking a new slot must be checked against, so a
   * user can't double-spend the same balance across concurrent call
   * bookings.
   */
  async getAvailableBalanceMinor(walletId: string): Promise<number> {
    const wallet = await this.prisma.wallet.findUniqueOrThrow({ where: { id: walletId } });
    const activeHolds = await this.prisma.walletHold.aggregate({
      where: { walletId, status: HoldStatus.ACTIVE },
      _sum: { amountMinor: true },
    });
    return wallet.balanceMinor - (activeHolds._sum.amountMinor ?? 0);
  }

  /**
   * Reserves `amountMinor` against a session so it can't be spent twice
   * while a call is pending/in-progress. Throws ConflictException if the
   * available balance (balance minus other active holds) can't cover it —
   * callers should surface this as "top up to book this slot."
   */
  async placeHold(params: {
    walletId: string;
    sessionId: string;
    amountMinor: number;
    expiresInMs?: number;
  }) {
    const available = await this.getAvailableBalanceMinor(params.walletId);
    if (available < params.amountMinor) {
      throw new ConflictException('Insufficient balance — top up to book this slot');
    }

    return this.prisma.walletHold.create({
      data: {
        walletId: params.walletId,
        sessionId: params.sessionId,
        amountMinor: params.amountMinor,
        status: HoldStatus.ACTIVE,
        expiresAt: new Date(Date.now() + (params.expiresInMs ?? 60 * 60 * 1000)),
      },
    });
  }

  /**
   * Converts an ACTIVE hold into the real ledger entries: a SESSION_DEBIT
   * against the aspirant's wallet and a SESSION_CREDIT of the SAME amount
   * to the mentor's wallet (flat rate, zero per-session platform cut — the
   * margin lives only in the topup conversion, see computeTopupCredit).
   * idempotencyKey is derived from the hold id, so retries are safe no-ops.
   */
  async consumeHoldAndBill(params: {
    holdId: string;
    mentorWalletId: string;
    sessionId: string;
    note?: string;
  }): Promise<boolean> {
    const hold = await this.prisma.walletHold.findUniqueOrThrow({
      where: { id: params.holdId },
    });
    if (hold.status !== HoldStatus.ACTIVE) {
      return false; // already consumed/released — safe no-op
    }

    await this.prisma.walletHold.update({
      where: { id: params.holdId },
      data: { status: HoldStatus.CONSUMED },
    });

    const applied = await this.applyLedgerEntry({
      walletId: hold.walletId,
      type: LedgerEntryType.SESSION_DEBIT,
      amountMinor: -hold.amountMinor,
      idempotencyKey: `hold-debit:${hold.id}`,
      sessionId: params.sessionId,
      note: params.note,
    });

    await this.applyLedgerEntry({
      walletId: params.mentorWalletId,
      type: LedgerEntryType.SESSION_CREDIT,
      amountMinor: hold.amountMinor,
      idempotencyKey: `hold-credit:${hold.id}`,
      sessionId: params.sessionId,
      note: params.note,
    });

    return applied;
  }

  /** Returns an unused hold to the spendable balance — e.g. a booking that
   * was cancelled or rejected before the call connected. No ledger entries:
   * the hold never decremented balanceMinor in the first place. */
  async releaseHold(holdId: string): Promise<void> {
    await this.prisma.walletHold.updateMany({
      where: { id: holdId, status: HoldStatus.ACTIVE },
      data: { status: HoldStatus.RELEASED },
    });
  }

  private async requireWallet(userId: string) {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      throw new BadRequestException('User has no wallet — this should never happen post-signup');
    }
    return wallet;
  }
}
