import { IsISO8601, IsOptional } from 'class-validator';

/**
 * Body for `POST /sessions/:id/accept`.
 *
 * `confirmedFor` — AUDIO_CALL only — is the concrete 30-minute slot the
 * mentor picked, either the aspirant's own offered time taken as-is, or any
 * other day/time via the mobile "Suggest another time" picker (unconstrained
 * since the 2026-09-11 confirm-sheet redesign — see resolveConfirmedSlot's
 * own doc comment for why the old "must be near requestedFor/requestedForAlt"
 * rule was dropped 2026-09-17). The service does backstop validation only
 * (30-min boundary, future, ≤ now + 5 days). Omit it to accept without
 * committing a slot (legacy behaviour, or an Instant request — for which any
 * confirmedFor is rejected).
 */
export class AcceptSessionDto {
  @IsOptional()
  @IsISO8601()
  confirmedFor?: string;
}
