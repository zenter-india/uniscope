import { UniversityType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * Query parameters for GET /universities.
 * `limit` arrives as a string and is coerced to a number by the global
 * ValidationPipe (transform + enableImplicitConversion).
 */
export class ListUniversitiesDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsEnum(UniversityType)
  type?: UniversityType;

  /** Academic field filter (Medical/Engineering/Law/etc) — see
   * University.stream. */
  @IsOptional()
  @IsString()
  stream?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
