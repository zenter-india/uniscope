import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

/** Minimum topup: 100 Uniminutes-equivalent paise (₹1) — purely a sanity
 * floor against zero/negative-amount order creation, not a business rule. */
const MIN_TOPUP_MINOR = 100;

export class CreateTopupDto {
  @Type(() => Number)
  @IsInt()
  @Min(MIN_TOPUP_MINOR)
  amountMinor!: number;
}
