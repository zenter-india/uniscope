import { TechnicalReport } from '@prisma/client';

export interface TechnicalReportResponse {
  id: string;
  message: string;
  platform: string | null;
  appVersion: string | null;
  status: string;
  adminNote: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
  /** Only populated on admin projections — the reporter's display name +
   * public unique id, never the internal user id or any PII. */
  reporter?: { displayName: string; uniqueId: string | null; role: string } | null;
}

type WithReporter = TechnicalReport & {
  user?: { displayName: string; uniqueId: string | null; role: string } | null;
};

export function toTechnicalReportResponse(
  row: WithReporter,
  includeReporter = false,
): TechnicalReportResponse {
  return {
    id: row.id,
    message: row.message,
    platform: row.platform,
    appVersion: row.appVersion,
    status: row.status,
    adminNote: row.adminNote,
    createdAt: row.createdAt,
    resolvedAt: row.resolvedAt,
    ...(includeReporter && { reporter: row.user ?? null }),
  };
}
