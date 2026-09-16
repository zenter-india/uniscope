import { getAdminEmail } from '../../../lib/adminAuth';
import { Badge, Card, EmptyState, Table } from '../../../components/ui';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';
import { DashboardShell } from '../DashboardShell';
import { getAgoraUsage, getRailwayUsage, getSupabaseUsage } from './actions';

function deploymentTone(status: string | null): Tone {
  if (!status) return 'neutral';
  const s = status.toUpperCase();
  if (s === 'SUCCESS') return 'success';
  if (['BUILDING', 'DEPLOYING', 'INITIALIZING', 'QUEUED'].includes(s)) return 'warning';
  if (['FAILED', 'CRASHED', 'REMOVED'].includes(s)) return 'danger';
  return 'neutral';
}

function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

export default async function IntegrationsPage() {
  const [email, railway, agora, supabase] = await Promise.all([
    getAdminEmail(),
    getRailwayUsage(),
    getAgoraUsage(),
    getSupabaseUsage(),
  ]);

  return (
    <DashboardShell title="Integrations & Usage" email={email}>
      <p className="mb-5 text-sm text-zinc-500 dark:text-zinc-400">
        Live usage and limits pulled directly from each third-party service's own API — not
        cached numbers typed in by hand. Currently wired: Railway, Agora, Supabase. MSG91 is
        next, blocked on confirming its reporting API access.
      </p>

      <Card className="mb-5 p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Supabase</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Database size vs. the Free Plan's 500 MB read-only threshold.
            </p>
          </div>
          {supabase.fetchedAt && (
            <span className="text-xs text-zinc-400 dark:text-zinc-500">
              Refreshed {new Date(supabase.fetchedAt).toLocaleTimeString()}
            </span>
          )}
        </div>

        {!supabase.configured ? (
          <EmptyState icon="settings">
            {supabase.error ?? 'Not configured — DATABASE_URL is missing in backend/.env.'}
          </EmptyState>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-zinc-200/80 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
              <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                Database size
              </p>
              <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {supabase.databaseSizeBytes != null ? formatBytes(supabase.databaseSizeBytes) : '—'}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200/80 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
              <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                Free plan limit
              </p>
              <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {supabase.databaseSizeLimitBytes != null ? formatBytes(supabase.databaseSizeLimitBytes) : '—'}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200/80 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
              <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                Remaining
              </p>
              <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {supabase.databaseSizeBytes != null && supabase.databaseSizeLimitBytes != null
                  ? formatBytes(supabase.databaseSizeLimitBytes - supabase.databaseSizeBytes)
                  : '—'}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200/80 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
              <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                API requests (24h)
              </p>
              <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {supabase.apiRequestCountConfigured
                  ? (supabase.apiRequestCount24h?.toLocaleString() ?? '—')
                  : 'No access token'}
              </p>
            </div>
          </div>
        )}
      </Card>

      <Card className="mb-5 p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Agora</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Live RTC calls right now — not monthly minutes used/remaining (that's Console-only
              for now; see CLAUDE.md).
            </p>
          </div>
          {agora.fetchedAt && (
            <span className="text-xs text-zinc-400 dark:text-zinc-500">
              Refreshed {new Date(agora.fetchedAt).toLocaleTimeString()}
            </span>
          )}
        </div>

        {!agora.configured ? (
          <EmptyState icon="settings">
            {agora.error ??
              'Not configured — set AGORA_APP_ID, AGORA_CUSTOMER_ID, and AGORA_CUSTOMER_SECRET in backend/.env.'}
          </EmptyState>
        ) : agora.error ? (
          <EmptyState icon="alert">Could not load usage — {agora.error}</EmptyState>
        ) : (
          <>
            <div className="mb-4 rounded-lg border border-zinc-200/80 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
              <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                Active calls right now
              </p>
              <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {agora.activeChannelCount ?? 0}
              </p>
            </div>
            {agora.channels && agora.channels.length > 0 && (
              <Table
                head={
                  <tr>
                    <Table.HeadCell>Channel</Table.HeadCell>
                    <Table.HeadCell>Users</Table.HeadCell>
                  </tr>
                }
              >
                {agora.channels.map((c) => (
                  <Table.Row key={c.channelName}>
                    <Table.Cell className="font-medium text-zinc-900 dark:text-zinc-100">
                      {c.channelName}
                    </Table.Cell>
                    <Table.Cell>{c.userCount}</Table.Cell>
                  </Table.Row>
                ))}
              </Table>
            )}
          </>
        )}
      </Card>

      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Railway</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {railway.workspaceName && railway.projectName
                ? `${railway.workspaceName} → ${railway.projectName}`
                : 'Billing and deployment status'}
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
        )}
      </Card>
    </DashboardShell>
  );
}
