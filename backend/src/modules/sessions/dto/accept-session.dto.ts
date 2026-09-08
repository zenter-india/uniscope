import { IsISO8601, IsOptional } from 'class-validator';

/**
 * Body for `POST /sessions/:id/accept`.
 *
 * `confirmedFor` — AUDIO_CALL only — is the concrete 30-minute slot the
 * mentor picked from the strip of half-hour slots around the aspirant's
 * requested time(s). The mobile confirm sheet only ever offers slots inside
 * one of the aspirant's ~4-hour anchor windows; the service does the
 * backstop validation (30-min boundary, future, ≤ now + 5 days, within ~4h
 * of requestedFor / requestedForAlt). Omit it to accept without committing
 * a slot (legacy behaviour, or an Instant request — for which any
 * confirmedFor is rejected).
 */
export class AcceptSessionDto {
  @IsOptional()
  @IsISO8601()
  confirmedFor?: string;
}
