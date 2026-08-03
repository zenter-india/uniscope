import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * Query parameters for GET /mentors.
 * `limit`/`minPrice`/`maxPrice` arrive as strings and are coerced to numbers
 * by the global ValidationPipe (transform + enableImplicitConversion).
 */
export class ListMentorsDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @IsString()
  universityId?: string;

  @IsOptional()
  @IsString()
  specialty?: string;

  /** Mentor's college field of study (Medical/Engineering/Law/etc) — the
   * primary discovery filter now that mentors span all streams, not just
   * medical. See UserProfile.stream. */
  @IsOptional()
  @IsString()
  stream?: string;

  /** Matches mentors whose `languages` array contains this value. */
  @IsOptional()
  @IsString()
  language?: string;

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
