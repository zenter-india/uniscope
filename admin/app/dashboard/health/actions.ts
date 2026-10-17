'use server';

import { backendFetch } from '../../../lib/backend';

export interface SystemHealthSummary {
  generatedAt: string;
  windowHours: number;
  database: { ok: boolean; latencyMs: number | null };
  server: { uptimeSeconds: number };
  payments: {
    topupsCount: number;
    topupsCreditedMinor: number;
    appleCredited: number;
    appleRefundedBeforeCredit: number;
    refundsNeedingManualFix: number;
    lastTopupAt: string | null;
  };
  calls: {
    requested: number;
    connected: number;
    endedBeforeConnect: number;
    noShows: number;
    pendingNow: number;
    liveNow: number;
    connectRatePercent: number | null;
  };
  users: { signups: number; activeUsers: number };
  queues: {
    verificationsPending: number;
    oldestVerificationAt: string | null;
    payoutsPending: number;
    oldestPayoutAt: string | null;
    reportsOpen: number;
    technicalReportsOpen: number;
  };
  warnings: string[];
}

export async function getSystemHealth(): Promise<
  { ok: true; data: SystemHealthSummary } | { ok: false; error: string }
> {
  try {
    return { ok: true, data: await backendFetch<SystemHealthSummary>('/admin/integrations/health') };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not reach the backend' };
  }
}
