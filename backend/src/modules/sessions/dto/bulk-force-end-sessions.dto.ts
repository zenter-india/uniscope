import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from 'class-validator';

/** ADMIN-only bulk force-end — e.g. clearing several sessions stuck from
 * the same incident (a push outage, a bad deploy) at once. */
export class BulkForceEndSessionsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  ids!: string[];
}
