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

export interface RailwayUsageSummary {
  configured: boolean;
  workspaceName?: string;
  projectName?: string;
  services?: RailwayService[];
  usageTotals?: AggregatedUsage[];
  estimatedUsage?: EstimatedUsage[];
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
