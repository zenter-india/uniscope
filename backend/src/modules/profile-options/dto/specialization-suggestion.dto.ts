import { IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';
import {
  DEGREE_NAME_MESSAGE,
  DEGREE_NAME_PATTERN,
} from './submit-custom-degree.dto.js';

export class SubmitSpecializationSuggestionDto {
  /** The mentor's college (as resolved when their profile was saved). */
  @IsString()
  @Length(1, 64)
  universityId!: string;

  /** The curated degree key the college's list is kept under, e.g. "MD/MS". */
  @IsString()
  @Length(2, 40)
  degree!: string;

  @IsString()
  @Length(2, 100)
  @Matches(DEGREE_NAME_PATTERN, { message: DEGREE_NAME_MESSAGE })
  name!: string;
}

export class ReviewSpecializationSuggestionDto {
  @IsIn(['PENDING', 'APPROVED', 'REJECTED'])
  status!: 'PENDING' | 'APPROVED' | 'REJECTED';

  /** Optional: fix spelling/casing while approving. */
  @IsOptional()
  @IsString()
  @Length(2, 100)
  @Matches(DEGREE_NAME_PATTERN, { message: DEGREE_NAME_MESSAGE })
  name?: string;
}
