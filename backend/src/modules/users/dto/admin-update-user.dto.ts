import { UserRole, VerificationStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { UpdateProfileDto } from './update-profile.dto.js';

/**
 * ADMIN edit of any user. Everything a user could set about themselves
 * ({@link UpdateProfileDto}) plus the fields only an admin should touch:
 * role, verification status, and the free-tier counters. Applied without the
 * self-service guards (a mentor's availability toggle here isn't gated on
 * verification, etc.) — the admin is trusted to know what they're doing.
 */
export class AdminUpdateUserDto extends UpdateProfileDto {
  /** ASPIRANT ↔ MENTOR only — an admin account can't be created or demoted
   * through this route. */
  @IsOptional()
  @IsIn([UserRole.ASPIRANT, UserRole.MENTOR])
  role?: UserRole;

  /** Manual override of the verification flag — does NOT run the normal
   * approval side effects (university linking etc.). */
  @IsOptional()
  @IsEnum(VerificationStatus)
  verificationStatus?: VerificationStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  freeChatsRemaining?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000)
  freeCallSecondsRemaining?: number;
}
