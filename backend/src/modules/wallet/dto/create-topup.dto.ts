import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

/** Minimum topup is ₹250, which credits 20 Uniminutes — see
 * WalletService.UNIMINUTE_PRICE_MINOR for the paid-to-credited conversion. */
const MIN_TOPUP_MINOR = 25_000;

export class CreateTopupDto {
  @Type(() => Number)
  @IsInt()
  @Min(MIN_TOPUP_MINOR)
  amountMinor!: number;
}
