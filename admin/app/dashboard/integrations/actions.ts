'use server';

import { backendFetch } from '../../../lib/backend';

interface AggregatedUsage {
  measurement: string;
  value: number;
}

interface EstimatedUsage {
  measurement: string;
  estimatedValue: number;
  projectId: string;
}

interface RailwayService {
  id: string;
  name: string;
  latestDeploymentStatus: string | null;
}

interface RailwayBilling {
  creditBalance: number;
  remainingUsageCreditBalance: number;
  currentUsage: number;
  hasExhaustedFreePlan: boolean;
  isTrialing: boolean;
  trialDaysRemaining: number;
  isPrepaying: boolean;
  state: string;
  usageLimit: { softLimit: number | null; hardLimit: number | null; isOverLimit: boolean } | null;
}

export interface RailwayUsageSummary {
  configured: boolean;
  workspaceName?: string;
  projectName?: string;
  services?: RailwayService[];
  usageTotals?: AggregatedUsage[];
  estimatedUsage?: EstimatedUsage[];
  billing?: RailwayBilling;
  fetchedAt?: string;
  error?: string;
}

export async function getRailwayUsage(): Promise<RailwayUsageSummary> {
  try {
    return await backendFetch<RailwayUsageSummary>('/admin/integrations/railway');
  } catch (e) {
    return {
      configured: false,
      error: e instanceof Error ? e.message : 'Could not reach the backend',
    };
  }
}
