import { VerificationStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/** Query params for the ADMIN-only GET /verification/history listing. */
export class ListVerificationHistoryDto {
  /** VERIFIED or REJECTED only — a resolved request in any other status
   * doesn't belong in "history" (see VerificationService.findHistory). */
  @IsOptional()
  @IsEnum(VerificationStatus)
  status?: VerificationStatus;

  /** Matches the applicant's display name (case-insensitive). */
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
