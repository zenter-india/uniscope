import { UserRole, VerificationStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class ListUsersDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsEnum(VerificationStatus)
  verificationStatus?: VerificationStatus;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isBanned?: boolean;

  /** Exact specialization, e.g. "Community Medicine". */
  @IsOptional()
  @IsString()
  specialization?: string;

  @IsOptional()
  @IsString()
  stream?: string;

  /** Exact degree, e.g. "MD/MS". */
  @IsOptional()
  @IsString()
  qualification?: string;

  /** UG or PG, worked out from the degree. */
  @IsOptional()
  @IsIn(['UG', 'PG'])
  level?: 'UG' | 'PG';

  @IsOptional()
  @IsString()
  state?: string;

  /** Only people linked to this college. */
  @IsOptional()
  @IsString()
  universityId?: string;

  /** `true` = only mentors currently accepting call bookings. */
  @IsOptional()
  @IsIn(['true'])
  accepting?: 'true';

  /** `true` = only users with at least one permission an admin has denied. */
  @IsOptional()
  @IsIn(['true'])
  restricted?: 'true';

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @IsIn(['joined', 'name', 'role', 'verification'])
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
