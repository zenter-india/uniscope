import { ReviewStatus } from '@prisma/client';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsIn, IsString } from 'class-validator';

/** ADMIN-only bulk moderation — e.g. hide a batch of spam reviews at once.
 * `kind` picks the table (mentor vs. university reviews are two separate
 * models, same as the single-row PATCH routes); all ids in one call must be
 * the same kind, matching how the admin list only ever shows one kind at a
 * time (the type filter tab). */
export class BulkSetReviewStatusDto {
  @IsIn(['mentor', 'university'])
  kind!: 'mentor' | 'university';

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsString({ each: true })
  ids!: string[];

  @IsEnum(ReviewStatus)
  status!: ReviewStatus;
}
