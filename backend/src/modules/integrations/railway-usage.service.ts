import { Injectable, Logger } from '@nestjs/common';

/**
 * Reads current-billing-period usage and per-service deployment status
 * straight from Railway's own public GraphQL API
 * (https://backboard.railway.com/graphql/v2) — there is no separate
 * "usage API," this is the exact same API that powers Railway's own
 * dashboard and CLI (`railway usage`).
 *
 * Needs a Workspace-scoped API token (not Account — broader than needed;
 * not Project — too narrow, can't read workspace-level usage) in
 * RAILWAY_API_TOKEN, plus RAILWAY_PROJECT_ID and RAILWAY_WORKSPACE_ID.
 * Generate one at https://railway.com/account/tokens, workspace = "Uniscope
 * Project". All three env vars are read once at construction; if any is
 * missing this service is silently inert (returns `configured: false`)
 * rather than throwing, so a deploy without them set doesn't break the app.
 *
 * `MetricMeasurement` values queried: CPU_USAGE (vCPU-hours), MEMORY_USAGE_GB
 * (GB-hours), NETWORK_TX_GB / NETWORK_RX_GB, DISK_USAGE_GB. These are
 * *cumulative for the current billing period*, not instantaneous —
 * `workspaceUsageTotals` is what's been consumed so far, `estimatedUsage`
 * is Railway's own projection of where it'll land by period end.
 *
 * Cached in-memory for CACHE_TTL_MS — Railway's public API rate limits are
 * modest (100-1000 requests/hour depending on plan tier), and this is an
 * admin-only, low-traffic page, so there's no reason to hit Railway on
 * every page load.
 */

const RAILWAY_API_URL = 'https://backboard.railway.com/graphql/v2';
const CACHE_TTL_MS = 5 * 60 * 1000;

const USAGE_MEASUREMENTS = [
  'CPU_USAGE',
  'MEMORY_USAGE_GB',
  'NETWORK_TX_GB',
  'NETWORK_RX_GB',
  'DISK_USAGE_GB',
] as const;

interface AggregatedUsage {
  measurement: string;
  value: number;
}

interface EstimatedUsage {
  measurement: string;
  estimatedValue: number;
  projectId: string;
}

interface ServiceSummary {
  id: string;
  name: string;
  latestDeploymentStatus: string | null;
}

/** `Customer.creditBalance`/`currentUsage` etc. are in whole USD dollars
 * (verified live — a $3.47 currentUsage on a real account came back as
 * `3.4653...`, not cents), unlike `UsageLimit`'s own `softLimit`/
 * `hardLimit`, which — per Railway's own CLI docs for `usage limit set`
 * (dollar-amount flags) — are also dollars despite the "Cents"-suffixed
 * sibling fields (`agentSoftLimitCents`) on the same type suggesting
 * otherwise; only the agent-specific fields are cents. */
interface CustomerBilling {
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
  services?: ServiceSummary[];
  usageTotals?: AggregatedUsage[];
  estimatedUsage?: EstimatedUsage[];
  billing?: CustomerBilling;
  fetchedAt?: string;
  error?: string;
}

const USAGE_QUERY = `
  query($workspaceId: String!, $projectId: String!, $measurements: [MetricMeasurement!]!) {
    workspace(workspaceId: $workspaceId) {
      name
      customer {
        creditBalance
        remainingUsageCreditBalance
        currentUsage
        hasExhaustedFreePlan
        isTrialing
        trialDaysRemaining
        isPrepaying
        state
        usageLimit { softLimit hardLimit isOverLimit }
      }
    }
    project(id: $projectId) {
      name
      services {
        edges {
          node {
            id
            name
            deployments(first: 1) {
              edges { node { status } }
            }
          }
        }
      }
    }
    workspaceUsageTotals(workspaceId: $workspaceId, measurements: $measurements) {
      measurement
      value
    }
    estimatedUsage(workspaceId: $workspaceId, measurements: $measurements) {
      measurement
      estimatedValue
      projectId
    }
  }
`;

@Injectable()
export class RailwayUsageService {
  private readonly logger = new Logger(RailwayUsageService.name);
  private readonly token = process.env.RAILWAY_API_TOKEN;
  private readonly projectId = process.env.RAILWAY_PROJECT_ID;
  private readonly workspaceId = process.env.RAILWAY_WORKSPACE_ID;

  private cached: { summary: RailwayUsageSummary; expiresAt: number } | null = null;

  async getUsageSummary(): Promise<RailwayUsageSummary> {
    if (!this.token || !this.projectId || !this.workspaceId) {
      return { configured: false, error: 'Railway integration not configured' };
    }

    if (this.cached && this.cached.expiresAt > Date.now()) {
      return this.cached.summary;
    }

    try {
      const res = await fetch(RAILWAY_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: USAGE_QUERY,
          variables: {
            workspaceId: this.workspaceId,
            projectId: this.projectId,
            measurements: USAGE_MEASUREMENTS,
          },
        }),
      });

      const body = (await res.json()) as {
        data?: {
          workspace: { name: string; customer: CustomerBilling | null } | null;
          project: {
            name: string;
            services: {
              edges: {
                node: {
                  id: string;
                  name: string;
                  deployments: { edges: { node: { status: string } }[] };
                };
              }[];
            };
          } | null;
          workspaceUsageTotals: AggregatedUsage[];
          estimatedUsage: EstimatedUsage[];
        };
        errors?: { message: string }[];
      };

      if (body.errors?.length || !body.data) {
        const message = body.errors?.[0]?.message ?? 'Unknown Railway API error';
        this.logger.warn(`[railway-usage] query failed: ${message}`);
        return { configured: true, error: message };
      }

      const summary: RailwayUsageSummary = {
        configured: true,
        workspaceName: body.data.workspace?.name,
        projectName: body.data.project?.name,
        services: (body.data.project?.services.edges ?? []).map((e) => ({
          id: e.node.id,
          name: e.node.name,
          latestDeploymentStatus: e.node.deployments.edges[0]?.node.status ?? null,
        })),
        usageTotals: body.data.workspaceUsageTotals,
        estimatedUsage: body.data.estimatedUsage,
        billing: body.data.workspace?.customer ?? undefined,
        fetchedAt: new Date().toISOString(),
      };

      this.cached = { summary, expiresAt: Date.now() + CACHE_TTL_MS };
      return summary;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`[railway-usage] request failed: ${message}`);
      return { configured: true, error: message };
    }
  }
}
