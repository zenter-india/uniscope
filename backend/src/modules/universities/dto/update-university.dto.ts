import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateUniversityDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  /** Academic field (Medical/Engineering/Law/etc) — see University.stream. */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  stream?: string;

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

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
