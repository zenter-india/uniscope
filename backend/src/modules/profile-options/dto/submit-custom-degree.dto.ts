import { IsIn, IsString, Length, Matches } from 'class-validator';
import { CUSTOM_DEGREE_STREAMS } from '../custom-degree-streams.js';

/** Letters (any script), digits, spaces and the punctuation real degree names
 * use — "B.Pharm", "M.Sc (Nursing)", "Diploma in X/Y", "B.A. & LL.B". */
export const DEGREE_NAME_PATTERN = /^[\p{L}\p{N} .,&()'/+-]+$/u;

export const DEGREE_NAME_MESSAGE =
  "name can only contain letters, numbers, spaces and . , & ( ) ' / + -";

export class SubmitCustomDegreeDto {
  /** One of the app's fixed streams. A free-typed "Others" stream has no
   * shared degree list to join, so the client doesn't send those. */
  @IsIn(CUSTOM_DEGREE_STREAMS)
  stream!: string;

  @IsString()
  @Length(2, 50)
  @Matches(DEGREE_NAME_PATTERN, { message: DEGREE_NAME_MESSAGE })
  name!: string;
}
