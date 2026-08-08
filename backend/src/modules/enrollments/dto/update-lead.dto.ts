import { EnrollmentLeadStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

/** ADMIN-only. Note there is deliberately no way to edit the submitted answers
 * themselves — a lead is a record of what someone actually said, and an admin
 * silently rewriting it would destroy that. Only the CRM fields are mutable. */
export class UpdateLeadDto {
  @IsOptional()
  @IsEnum(EnrollmentLeadStatus)
  status?: EnrollmentLeadStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  adminNote?: string;

  /** Set when the lead has been turned into a real account, linking the two
   * so the same person can't be converted twice. */
  @IsOptional()
  @IsString()
  convertedUserId?: string;
}
