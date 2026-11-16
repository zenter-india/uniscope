import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/** Every field optional -- a PATCH can flip isActive, rename, and/or reset
 * the password in one call; the service only touches whichever fields are
 * actually present. */
export class UpdateAdminAccountDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string;

  /** New plaintext password, hashed before it touches the DB. Omit to leave
   * the existing password unchanged. */
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(200)
  password?: string;

  @IsOptional()
  @IsBoolean()
  fullAccess?: boolean;

  /** The complete list of allowed keys (replaces the stored one). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  permissions?: string[];
}
