import { getAdminEmail } from '../../../lib/adminAuth';
import { Badge, Card, EmptyState, Table } from '../../../components/ui';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';
import { DashboardShell } from '../DashboardShell';
import { getRailwayUsage } from './actions';

/** Human labels + units for the raw MetricMeasurement enum values Railway's
 * API returns. usageTotals are cumulative for the CURRENT billing period
 * (not instantaneous); estimatedUsage is Railway's own projection of where
 * each measurement will land by the period's end. */
const MEASUREMENT_META: Record<string, { label: string; unit: string; decimals: number }> = {
  CPU_USAGE: { label: 'CPU', unit: 'vCPU-hours', decimals: 1 },
  MEMORY_USAGE_GB: { label: 'Memory', unit: 'GB-hours', decimals: 0 },
  NETWORK_TX_GB: { label: 'Network out', unit: 'GB', decimals: 2 },
  NETWORK_RX_GB: { label: 'Network in', unit: 'GB', decimals: 2 },
  DISK_USAGE_GB: { label: 'Disk', unit: 'GB', decimals: 2 },
};

const MEASUREMENT_ORDER = ['CPU_USAGE', 'MEMORY_USAGE_GB', 'NETWORK_TX_GB', 'NETWORK_RX_GB', 'DISK_USAGE_GB'];

function formatValue(measurement: string, value: number): string {
  const meta = MEASUREMENT_META[measurement];
  if (!meta) return value.toLocaleString();
  return `${value.toLocaleString(undefined, { maximumFractionDigits: meta.decimals })} ${meta.unit}`;
}

function deploymentTone(status: string | null): Tone {
  if (!status) return 'neutral';
  const s = status.toUpperCase();
  if (s === 'SUCCESS') return 'success';
  if (['BUILDING', 'DEPLOYING', 'INITIALIZING', 'QUEUED'].includes(s)) return 'warning';
  if (['FAILED', 'CRASHED', 'REMOVED'].includes(s)) return 'danger';
  return 'neutral';
}

export default async function IntegrationsPage() {
  const [email, railway] = await Promise.all([getAdminEmail(), getRailwayUsage()]);

  const estimatedByMeasurement = new Map(
    (railway.estimatedUsage ?? []).map((e) => [e.measurement, e.estimatedValue]),
  );

  return (
    <DashboardShell title="Integrations & Usage" email={email}>
      <p className="mb-5 text-sm text-zinc-500 dark:text-zinc-400">
        Live usage and limits pulled directly from each third-party service's own API — not
        cached numbers typed in by hand. Currently wired: Railway. Agora, Supabase, and MSG91
        are next, each blocked on its own separate credential.
      </p>

      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Railway</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {railway.workspaceName && railway.projectName
                ? `${railway.workspaceName} → ${railway.projectName}`
                : 'Compute, network, and deployment status'}
            </p>
          </div>
          {railway.fetchedAt && (
            <span className="text-xs text-zinc-400 dark:text-zinc-500">
              Refreshed {new Date(railway.fetchedAt).toLocaleTimeString()}
            </span>
          )}
        </div>

        {railway.configured && railway.billing && (
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-zinc-200/80 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
              <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                Spent this period
              </p>
              <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                ${railway.billing.currentUsage.toFixed(2)}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200/80 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
              <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                Credit remaining
              </p>
              <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                ${railway.billing.remainingUsageCreditBalance.toFixed(2)}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200/80 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
              <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                Hard spend limit
              </p>
              <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {railway.billing.usageLimit?.hardLimit != null
                  ? `$${railway.billing.usageLimit.hardLimit.toFixed(2)}`
                  : 'None set'}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200/80 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
              <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                Plan state
              </p>
              <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {railway.billing.isTrialing
                  ? `Trial · ${railway.billing.trialDaysRemaining}d left`
                  : railway.billing.state}
              </p>
            </div>
          </div>
        )}

        {!railway.configured ? (
          <EmptyState icon="settings">
            {railway.error ??
              'Not configured — set RAILWAY_API_TOKEN, RAILWAY_PROJECT_ID, and RAILWAY_WORKSPACE_ID in backend/.env.'}
          </EmptyState>
        ) : railway.error ? (
          <EmptyState icon="alert">Could not load usage — {railway.error}</EmptyState>
        ) : (
          <>
            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {MEASUREMENT_ORDER.map((m) => {
                const total = railway.usageTotals?.find((u) => u.measurement === m);
                const estimated = estimatedByMeasurement.get(m);
                if (!total) return null;
                return (
                  <div
                    key={m}
                    className="rounded-lg border border-zinc-200/80 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-800/40"
                  >
                    <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                      {MEASUREMENT_META[m]?.label ?? m}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {formatValue(m, total.value)}
                    </p>
                    {estimated !== undefined && (
                      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                        est. {formatValue(m, estimated)} by period end
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <Table
              head={
                <tr>
                  <Table.HeadCell>Service</Table.HeadCell>
                  <Table.HeadCell>Latest deployment</Table.HeadCell>
                </tr>
              }
            >
              {(railway.services ?? []).map((s) => (
                <Table.Row key={s.id}>
                  <Table.Cell className="font-medium text-zinc-900 dark:text-zinc-100">
                    {s.name}
                  </Table.Cell>
                  <Table.Cell>
                    <Badge tone={deploymentTone(s.latestDeploymentStatus)}>
                      {s.latestDeploymentStatus ?? 'Unknown'}
                    </Badge>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table>
          </>
        )}
      </Card>
    </DashboardShell>
  );
}
