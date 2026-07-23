import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

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
