import { IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';
import {
  DEGREE_NAME_MESSAGE,
  DEGREE_NAME_PATTERN,
} from './submit-custom-degree.dto.js';

export class ReviewCustomDegreeDto {
  @IsIn(['PENDING', 'APPROVED', 'REJECTED'])
  status!: 'PENDING' | 'APPROVED' | 'REJECTED';

  /** Optional: fix casing/typos while approving ("b pharm" -> "B.Pharm"). */
  @IsOptional()
  @IsString()
  @Length(2, 50)
  @Matches(DEGREE_NAME_PATTERN, { message: DEGREE_NAME_MESSAGE })
  name?: string;
}
