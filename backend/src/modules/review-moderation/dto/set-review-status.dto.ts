import { ReviewStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class SetReviewStatusDto {
  @IsEnum(ReviewStatus)
  status!: ReviewStatus;
}
