import { ReportStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class ListReportsDto {
  @IsOptional()
  @IsEnum(ReportStatus)
  status?: ReportStatus;

  /** Reports filed by this user — the "Reports filed by user" link on the
   * user-detail page. */
  @IsOptional()
  @IsUUID()
  reporterId?: string;

  /** Reports directly targeting this user (`targetType: USER`) — the
   * "Reports against user" link on the user-detail page. Matches exactly
   * what `UsersService.findDetailAdmin`'s `reportsAgainst` counter counts. */
  @IsOptional()
  @IsUUID()
  targetUserId?: string;

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
