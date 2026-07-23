import { UniversityType } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, IsUrl, Max, MaxLength, Min } from 'class-validator';

export class CreateUniversityDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsEnum(UniversityType)
  type!: UniversityType;

  @IsString()
  @MaxLength(100)
  state!: string;

  @IsString()
  @MaxLength(100)
  city!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  nirfRank?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  mbbsSeats?: number;

  @IsOptional()
  @IsInt()
  @Min(1800)
  @Max(2100)
  establishedYear?: number;

  @IsOptional()
  @IsUrl()
  @MaxLength(300)
  website?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
