import { PayoutStatus } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/** Admin transitions a payout through its lifecycle. PENDING is the only
 * status a request can never be manually set back to. */
export class ProcessPayoutDto {
  @IsEnum(PayoutStatus)
  @IsIn([PayoutStatus.PROCESSING, PayoutStatus.COMPLETED, PayoutStatus.FAILED])
  status!: PayoutStatus;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  bankReference?: string;
}
