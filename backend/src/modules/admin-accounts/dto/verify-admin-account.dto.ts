import { IsString, MaxLength } from 'class-validator';

/** Deliberately not @IsEmail() -- a malformed "email" here should fail the
 * lookup and fall through to the same generic { ok: false } every other
 * wrong-credential case gets, not a 400 that confirms the field even parses
 * as an email (a tiny extra data point an attacker doesn't need). */
export class VerifyAdminAccountDto {
  @IsString()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MaxLength(200)
  password!: string;
}
