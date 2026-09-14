import {
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
}
