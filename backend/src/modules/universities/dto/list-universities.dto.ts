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

  /** Degree level filter (e.g. "UG", "PG") — see University.levels. Lets a
   * UG-specific college search exclude PG-only rows (DNB/Diploma/etc
   * accreditation sites with no UG intake), which otherwise pollute a
   * general search with generic hospital names that repeat across many
   * unrelated branches (e.g. many different "District Hospital"s). */
  @IsOptional()
  @IsString()
  level?: string;

  @IsOptional()
  @IsString()
  search?: string;

  /** `browse=true` returns every matching row uncapped (no `limit`/cursor
   * pagination) — for a type-to-search College picker that's meant to
   * browse the full list, not just the first page. See
   * UniversitiesService.findAll's doc comment. Cursor-paginated callers
   * (e.g. the Discover/Colleges tab) must omit this. */
  @IsOptional()
  @IsString()
  browse?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
