import { getAdminEmail } from '../../../lib/adminAuth';
import { DashboardShell } from '../DashboardShell';
import { SettingsForm } from './SettingsForm';
import { getSettings } from './actions';

export default async function SettingsPage() {
  const [email, settings] = await Promise.all([
    getAdminEmail(),
    getSettings().catch(() => []),
  ]);

  return (
    <DashboardShell title="Settings" email={email}>
      <p className="mb-5 text-sm text-zinc-500 dark:text-zinc-400">
        Operational knobs you can change yourself without needing a code deploy. A setting
        left untouched keeps using its default — this list can never be empty in a way that
        breaks anything.
      </p>
      {settings.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Settings are unavailable right now.</p>
      ) : (
        <SettingsForm initial={settings} />
      )}
    </DashboardShell>
  );
}
