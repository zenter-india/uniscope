import { Type } from 'class-transformer';
import { IsInt, IsString, MaxLength, MinLength, NotEquals } from 'class-validator';

/** ADMIN manual balance correction. */
export class AdjustWalletDto {
  /** Signed minor units — positive credits the wallet, negative debits it. */
  @Type(() => Number)
  @IsInt()
  @NotEquals(0)
  amountMinor!: number;

  /** Mandatory audit note — the only record of why the balance moved. */
  @IsString()
  @MinLength(3)
  @MaxLength(280)
  reason!: string;
}
