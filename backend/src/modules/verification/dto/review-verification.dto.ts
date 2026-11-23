import {
  IsBoolean,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

export class ReviewVerificationDto {
  @IsBoolean()
  approve!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  /** Approving a profile whose typed specialization is still a suggestion:
   * add it to the college's shared list as typed. */
  @IsOptional()
  @IsBoolean()
  addSuggestedSpecialization?: boolean;

  /** ...or use this entry from the college's existing list instead (the typed
   * one was a misspelling or duplicate). Not together with the above. */
  @IsOptional()
  @IsString()
  @Length(2, 100)
  useSpecialization?: string;
}
