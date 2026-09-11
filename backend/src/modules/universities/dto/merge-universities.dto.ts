import { ArrayMinSize, ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class MergeUniversitiesDto {
  /** The university that survives — every loser's data gets repointed here. */
  @IsUUID()
  winnerId!: string;

  /** The duplicate(s) being merged away — deactivated once their data has
   * been repointed. Never includes `winnerId` (checked in the service, not
   * here, since that check needs both fields at once). */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  loserIds!: string[];
}
