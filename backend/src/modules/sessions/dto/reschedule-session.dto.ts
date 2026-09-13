import { IsISO8601 } from 'class-validator';

/**
 * Body for `PATCH /sessions/:id/reschedule`. Either party on an already-
 * ACCEPTED call may move `confirmedFor` to a new 30-minute slot — unlike
 * `AcceptSessionDto.confirmedFor`, this is not required to sit near the
 * aspirant's original requestedFor/requestedForAlt anchors (that anchoring
 * only ever applied to the initial confirm; the whole point of a reschedule
 * is moving away from the original time). `SessionsService.reschedule` does
 * the real validation (30-min boundary, future, ≤ now + 5 days, no overlap
 * with the mentor's other confirmed calls).
 */
export class RescheduleSessionDto {
  @IsISO8601()
  confirmedFor!: string;
}
