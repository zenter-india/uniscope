import { ReviewStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

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
