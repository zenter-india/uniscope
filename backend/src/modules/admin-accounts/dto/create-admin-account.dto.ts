import {
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
}
