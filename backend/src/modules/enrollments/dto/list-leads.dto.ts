import { EnrollmentLeadRole, EnrollmentLeadStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

/** Query parameters for the ADMIN-only GET /enrollments listing. */
export class ListLeadsDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @IsEnum(EnrollmentLeadRole)
  role?: EnrollmentLeadRole;

  @IsOptional()
  @IsEnum(EnrollmentLeadStatus)
  status?: EnrollmentLeadStatus;

  /** `failed`: no account, and the server recorded why creating it failed.
   * `missing`: no account at all, including older leads with no recorded
   * reason. Both leave out leads rejected on purpose. */
  @IsOptional()
  @IsIn(['failed', 'missing'])
  account?: 'failed' | 'missing';

  /** Matches against name, phone, email, or college name. */
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(['created', 'name', 'status', 'role'])
  sortBy?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
