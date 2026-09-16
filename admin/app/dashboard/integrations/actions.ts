'use server';

import { backendFetch } from '../../../lib/backend';

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

interface AgoraChannel {
  channelName: string;
  userCount: number;
}

export interface AgoraUsageSummary {
  configured: boolean;
  activeChannelCount?: number;
  channels?: AgoraChannel[];
  fetchedAt?: string;
  error?: string;
}

export async function getAgoraUsage(): Promise<AgoraUsageSummary> {
  try {
    return await backendFetch<AgoraUsageSummary>('/admin/integrations/agora');
  } catch (e) {
    return {
      configured: false,
      error: e instanceof Error ? e.message : 'Could not reach the backend',
    };
  }
}

export interface SupabaseUsageSummary {
  configured: boolean;
  databaseSizeBytes?: number;
  databaseSizeLimitBytes?: number;
  apiRequestCount24h?: number;
  apiRequestCountConfigured: boolean;
  fetchedAt?: string;
  error?: string;
}

export async function getSupabaseUsage(): Promise<SupabaseUsageSummary> {
  try {
    return await backendFetch<SupabaseUsageSummary>('/admin/integrations/supabase');
  } catch (e) {
    return {
      configured: false,
      apiRequestCountConfigured: false,
      error: e instanceof Error ? e.message : 'Could not reach the backend',
    };
  }
}
