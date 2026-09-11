import { EnrollmentLeadStatus } from '@prisma/client';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsString } from 'class-validator';

/** ADMIN-only bulk status change — the one CRM action worth doing on many
 * leads at once (e.g. mark a batch "Contacted" after a call session).
 * Deliberately status-only, not a bulk version of every UpdateLeadDto field
 * — adminNote and convertedUserId are inherently per-lead. */
export class BulkUpdateLeadsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsString({ each: true })
  ids!: string[];

  @IsEnum(EnrollmentLeadStatus)
  status!: EnrollmentLeadStatus;
}
