import { SessionStatus, SessionType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

/** ADMIN session browser filter — unlike ListSessionsDto this is not scoped
 * to a party; it lists every session in the system. */
export class ListSessionsAdminDto {
  @IsOptional()
  @IsEnum(SessionStatus)
  status?: SessionStatus;

  @IsOptional()
  @IsEnum(SessionType)
  type?: SessionType;

  /** Matches against either party's display name (case-insensitive). */
  @IsOptional()
  @IsString()
  search?: string;

  /** Sessions where this user was either the aspirant or the mentor — the
   * "Sessions as aspirant/mentor" counts on the user-detail page link here
   * so an admin can see the actual list, not just a bare number. */
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @IsIn(['requested', 'cost', 'status'])
  sortBy?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
