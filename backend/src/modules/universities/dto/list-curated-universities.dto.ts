import { IsOptional, IsString } from 'class-validator';

/**
 * Query parameters for GET /universities/curated — the mentor form's
 * College/University list for a given stream+degree (see
 * UniversitiesService.findCurated). `stream` + `degree` are always
 * required.
 *
 * `browse=true` switches from the default "top N by specialization count"
 * curation (DNB/DM-MCh/Diploma — too many colleges to list in full, so a
 * short useful subset + free-text "Other") to returning the FULL matching
 * list instead (MD/MS — small enough, and the mentor form wants a
 * fully browsable + type-to-search picker there, not a curated subset).
 * `search` filters that full list by college name — only meaningful
 * alongside `browse=true`; the curated (non-browse) mode ignores it.
 */
export class ListCuratedUniversitiesDto {
  @IsString()
  stream!: string;

  @IsString()
  degree!: string;

  @IsOptional()
  @IsString()
  browse?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
