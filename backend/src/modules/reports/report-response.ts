import { Report } from '@prisma/client';

export interface ReportResponse {
  id: string;
  reporterId: string;
  targetType: Report['targetType'];
  targetId: string;
  reason: Report['reason'];
  description: string | null;
  status: Report['status'];
  actionedBy: string | null;
  resolution: string | null;
  createdAt: Date;
  /** Admin-list-only convenience field — populated when the row was fetched
   * with the reporter relation included (see ReportsService.findAll). */
  reporterDisplayName?: string;
}

export function toReportResponse(
  report: Report & { reporter?: { displayName: string } },
): ReportResponse {
  return {
    id: report.id,
    reporterId: report.reporterId,
    targetType: report.targetType,
    targetId: report.targetId,
    reason: report.reason,
    description: report.description,
    status: report.status,
    actionedBy: report.actionedBy,
    resolution: report.resolution,
    createdAt: report.createdAt,
    ...(report.reporter && { reporterDisplayName: report.reporter.displayName }),
  };
}
