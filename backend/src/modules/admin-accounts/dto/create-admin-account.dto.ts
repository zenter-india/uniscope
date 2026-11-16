import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateAdminAccountDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  /** Plaintext, hashed before it ever touches the DB — see AdminAccountsService.create. */
  @IsString()
  @MinLength(10)
  @MaxLength(200)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string;

  /** true = every section of the panel. Defaults to false for a new admin:
   * the creator picks what they can open and change in `permissions`. */
  @IsOptional()
  @IsBoolean()
  fullAccess?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  permissions?: string[];
}
