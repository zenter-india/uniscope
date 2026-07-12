import { ReportStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Min, MaxLength } from 'class-validator';

/** Admin resolution of a report. If `refundAmountMinor` is set, the report
 * must target a SESSION — the amount is credited back to that session's
 * aspirant as a manual REFUND ledger entry (see decision: mentor-side call
 * drops are never auto-refunded, always admin-reviewed). */
export class ResolveReportDto {
  @IsEnum(ReportStatus)
  status!: ReportStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  resolution?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  refundAmountMinor?: number;
}
