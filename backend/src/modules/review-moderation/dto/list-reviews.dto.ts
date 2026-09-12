import { ReviewStatus } from '@prisma/client';
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

export class ListReviewsDto {
  /** Which review table to page through. Defaults to mentor reviews. */
  @IsOptional()
  @IsIn(['mentor', 'university'])
  type?: 'mentor' | 'university';

  @IsOptional()
  @IsEnum(ReviewStatus)
  status?: ReviewStatus;

  /** Matches the review text (case-insensitive). */
  @IsOptional()
  @IsString()
  search?: string;

  /** Reviews written by this user (the aspirant on a mentor review, or the
   * author on a university review) — the "Reviews filed by user" link on
   * the user-detail page. */
  @IsOptional()
  @IsUUID()
  authorId?: string;

  /** Reviews *about* this user — only meaningful for `type=mentor` (the
   * mentor being reviewed). The "Mentor reviews received" link on the
   * user-detail page. */
  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @IsIn(['created', 'rating', 'status'])
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
