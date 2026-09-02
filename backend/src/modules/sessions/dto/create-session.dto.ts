import { Type } from 'class-transformer';
import { SessionType } from '@prisma/client';
import { IsEnum, IsIn, IsString, ValidateIf } from 'class-validator';

/** Fixed pre-paid call slots — see SessionsService.CALL_SLOT_MINUTES.
 * Shortest slot is 6 min (was 5, per explicit client request) — this also
 * drives the no-show grace period (always 50% of the slot, see
 * sweepCallNoShows) and the call-overrun extension block (always
 * CALL_SLOT_MINUTES[0], see SessionsService.extend), so both follow this
 * change automatically. */
export const CALL_SLOT_MINUTES = [6, 10, 20] as const;

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
}
