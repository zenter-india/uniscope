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
}

export function toReportResponse(report: Report): ReportResponse {
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
  };
}
