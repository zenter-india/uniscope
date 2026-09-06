import { Type } from 'class-transformer';
import { SessionType } from '@prisma/client';
import {
  IsEnum,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';

/** Fixed pre-paid call slots (product decision, 2026-09-06 — replaces the
 * earlier flat ₹10/min-for-every-slot pricing entirely). Each slot has its
 * own fixed rupee price rather than being derived from a per-minute rate —
 * see CALL_SLOT_PRICE_MINOR. This also drives the no-show grace period
 * (always 50% of the slot's price, see sweepCallNoShows) and the
 * call-overrun extension block (always CALL_SLOT_MINUTES[0] at its price,
 * see SessionsService.extendCall), so both follow this change
 * automatically. */
export const CALL_SLOT_MINUTES = [10, 20, 40, 60] as const;

/** Total price of each slot, in minor units (paise) — NOT minutes × a flat
 * rate. Client-specified: 10 min → ₹250, 20 min → ₹400, 40 min → ₹750,
 * 60 min → ₹1000. Works out to ₹25/₹20/₹18.75/₹16.67 per minute — cheaper
 * per minute the longer the slot, unlike the old flat rate. The mentor is
 * still paid this exact same amount (zero platform margin on calls, same
 * as every other billing path) — only the recharge conversion carries a
 * margin (see WalletService.computeTopupCredit). Since 1 Uniminute = ₹10 =
 * 1000 minor units (WalletService.UNIMINUTE_VALUE_MINOR) still holds for
 * top-ups, these prices are still whole numbers of Uniminutes (25/40/75/100)
 * — but a slot's Uniminute cost no longer equals its minute count, so
 * Uniminutes are a plain currency unit here, not a literal minutes reading. */
export const CALL_SLOT_PRICE_MINOR: Record<(typeof CALL_SLOT_MINUTES)[number], number> = {
  10: 25_000,
  20: 40_000,
  40: 75_000,
  60: 100_000,
};

export function callSlotPriceMinor(slotMinutes: number): number {
  const price = (CALL_SLOT_PRICE_MINOR as Record<number, number>)[slotMinutes];
  if (price === undefined) {
    throw new Error(`No price configured for call slot: ${slotMinutes} min`);
  }
  return price;
}

export class CreateSessionDto {
  @IsString()
  mentorId!: string;

  @IsEnum(SessionType)
  type!: SessionType;

  /** Required for AUDIO_CALL — the fixed slot the aspirant is pre-paying
   * for. Ignored for CHAT (chat has no slot concept, just free-tier +
   * eventual metered debits). */
  @ValidateIf((dto: CreateSessionDto) => dto.type === SessionType.AUDIO_CALL)
  @Type(() => Number)
  @IsIn(CALL_SLOT_MINUTES)
  slotMinutes?: number;

  /** AUDIO_CALL only, optional. ISO-8601 timestamp the aspirant wants to
   * connect at — from the "When?" step: a mentor free-window quick-pick or
   * a custom slot. Omitted / null = "Instant" (connect once the mentor
   * accepts, the original flow). Advisory: nothing is reserved and no
   * reminder is scheduled. The service rejects a value in the past or more
   * than 4 days ahead. */
  @ValidateIf(
    (dto: CreateSessionDto) =>
      dto.type === SessionType.AUDIO_CALL && dto.requestedFor != null,
  )
  @IsOptional()
  @IsISO8601()
  requestedFor?: string;
}
