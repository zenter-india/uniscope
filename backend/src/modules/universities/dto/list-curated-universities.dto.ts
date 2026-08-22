import { IsString } from 'class-validator';

/**
 * Query parameters for GET /universities/curated — the mentor form's
 * short curated College/University list (see CollegesService.findCurated).
 * Unlike the general /universities search, `stream` + `degree` are both
 * required: this endpoint only has data for one combination today
 * (Medical / DNB) and returns an empty list for anything else.
 */
export class ListCuratedUniversitiesDto {
  @IsString()
  stream!: string;

  @IsString()
  degree!: string;
}
