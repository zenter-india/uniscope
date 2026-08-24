import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { REVIEW_TAGS } from './review-tags.js';

export class CreateUniversityReviewDto {
  @IsInt()
  @Min(1)
  @Max(5)
  overallRating!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  facultyRating?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  infrastructureRating?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  clinicalExposureRating?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  campusLifeRating?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  placementsRating?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  workloadRating?: number;

  @IsOptional()
  @IsBoolean()
  wouldRecommend?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(REVIEW_TAGS.length)
  @IsIn(REVIEW_TAGS, { each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  pros?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  cons?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  body?: string;
}
