import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** Body of "Retry account creation" for a website lead. */
export class RetryLeadAccountDto {
  /** The alias to give the account. Leave out to use what the person typed on
   * the form; if that is taken the next free one is used ("John" -> "John1"). */
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  alias?: string;
}
