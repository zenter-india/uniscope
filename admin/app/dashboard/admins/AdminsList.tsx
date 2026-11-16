'use client';

import { useState, useTransition } from 'react';
import { Badge, Button, Card, Input, Label, Table } from '../../../components/ui';
import { ConfirmButton } from '../../../components/ConfirmButton';
import { toast } from '../../../lib/toast';
import {
  createAdminAccount,
  resetAdminAccountPassword,
  setAdminAccountActive,
  updateAdminAccountPermissions,
  type AdminAccount,
} from './actions';
import { PermissionMatrix, type PermissionValue } from './PermissionMatrix';
import { ADMIN_SECTIONS } from '../../../lib/permissions';

const MIN_PASSWORD_LENGTH = 10;

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function accessSummary(a: { fullAccess: boolean; permissions: string[] }): string {
  if (a.fullAccess) return 'Full access';
  const viewable = ADMIN_SECTIONS.filter((s) => a.permissions.includes(`${s.key}:view`)).length;
  const editable = ADMIN_SECTIONS.filter((s) => a.permissions.includes(`${s.key}:edit`)).length;
  if (viewable === 0) return 'No access';
  return `${viewable} section${viewable === 1 ? '' : 's'} (${editable} editable)`;
}

export function AdminsList({
  initial,
  rootEmail,
}: {
  initial: AdminAccount[];
  rootEmail: string | null;
}) {
  const [accounts, setAccounts] = useState(initial);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-6">
      <CreateAdminForm
        onCreated={(account) => setAccounts((prev) => [...prev, account])}
      />

      <Table
        head={
          <tr>
            <Table.HeadCell>Email</Table.HeadCell>
            <Table.HeadCell>Name</Table.HeadCell>
            <Table.HeadCell>Status</Table.HeadCell>
            <Table.HeadCell>Access</Table.HeadCell>
            <Table.HeadCell>Last login</Table.HeadCell>
            <Table.HeadCell>Created</Table.HeadCell>
            <Table.HeadCell>Actions</Table.HeadCell>
          </tr>
        }
      >
        {rootEmail && (
          <Table.Row>
            <Table.Cell className="font-medium text-zinc-900 dark:text-zinc-100">{rootEmail}</Table.Cell>
            <Table.Cell>Root credential</Table.Cell>
            <Table.Cell>
              <Badge tone="success">Active</Badge>
            </Table.Cell>
            <Table.Cell>Full access</Table.Cell>
            <Table.Cell className="text-zinc-400 dark:text-zinc-500">—</Table.Cell>
            <Table.Cell className="text-zinc-400 dark:text-zinc-500">—</Table.Cell>
            <Table.Cell className="text-xs text-zinc-400 dark:text-zinc-500">
              Set via ADMIN_EMAIL / ADMIN_PASSWORD env vars, not editable here
            </Table.Cell>
          </Table.Row>
        )}

        {accounts.map((account) => (
          <AdminRow
            key={account.id}
            account={account}
            isPending={isPending}
            onUpdated={(updated) =>
              setAccounts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
            }
            onToggleActive={(id, isActive) => {
              startTransition(async () => {
                const res = await setAdminAccountActive(id, isActive);
                if (!res.ok) {
                  toast.error(res.error);
                  return;
                }
                setAccounts((prev) =>
                  prev.map((a) => (a.id === id ? { ...a, isActive } : a)),
                );
                toast.success(isActive ? 'Account reactivated.' : 'Account deactivated.');
              });
            }}
          />
        ))}
      </Table>

      {accounts.length === 0 && !rootEmail && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">No admin accounts yet.</p>
      )}
    </div>
  );
}

function AdminRow({
  account,
  isPending,
  onToggleActive,
  onUpdated,
}: {
  account: AdminAccount;
  isPending: boolean;
  onToggleActive: (id: string, isActive: boolean) => void;
  onUpdated: (account: AdminAccount) => void;
}) {
  const [resetting, setResetting] = useState(false);
  const [editingAccess, setEditingAccess] = useState(false);

  return (
    <>
      <Table.Row>
        <Table.Cell className="font-medium text-zinc-900 dark:text-zinc-100">{account.email}</Table.Cell>
        <Table.Cell>{account.displayName || '—'}</Table.Cell>
        <Table.Cell>
          <Badge tone={account.isActive ? 'success' : 'danger'}>
            {account.isActive ? 'Active' : 'Deactivated'}
          </Badge>
        </Table.Cell>
        <Table.Cell className="text-zinc-700 dark:text-zinc-300">{accessSummary(account)}</Table.Cell>
        <Table.Cell className="text-zinc-500 dark:text-zinc-400">{formatDate(account.lastLoginAt)}</Table.Cell>
        <Table.Cell className="text-zinc-500 dark:text-zinc-400">{formatDate(account.createdAt)}</Table.Cell>
        <Table.Cell>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" disabled={isPending} onClick={() => setEditingAccess((v) => !v)}>
              {editingAccess ? 'Close' : 'Permissions'}
            </Button>
            <Button size="sm" variant="secondary" disabled={isPending} onClick={() => setResetting((r) => !r)}>
              {resetting ? 'Cancel' : 'Reset password'}
            </Button>
            {account.isActive ? (
              <ConfirmButton
                size="sm"
                variant="danger"
                disabled={isPending}
                onConfirm={() => onToggleActive(account.id, false)}
              >
                Deactivate
              </ConfirmButton>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                disabled={isPending}
                onClick={() => onToggleActive(account.id, true)}
              >
                Reactivate
              </Button>
            )}
          </div>
        </Table.Cell>
      </Table.Row>
      {editingAccess && (
        <Table.Row>
          <Table.Cell colSpan={7} className="bg-zinc-50/60 dark:bg-zinc-800/30">
            <EditPermissionsInline
              account={account}
              onSaved={(updated) => {
                onUpdated(updated);
                setEditingAccess(false);
              }}
            />
          </Table.Cell>
        </Table.Row>
      )}
      {resetting && (
        <Table.Row>
          <Table.Cell colSpan={7} className="bg-zinc-50/60 dark:bg-zinc-800/30">
            <ResetPasswordInline accountId={account.id} onDone={() => setResetting(false)} />
          </Table.Cell>
        </Table.Row>
      )}
    </>
  );
}

function EditPermissionsInline({
  account,
  onSaved,
}: {
  account: AdminAccount;
  onSaved: (account: AdminAccount) => void;
}) {
  const [value, setValue] = useState<PermissionValue>({
    fullAccess: account.fullAccess,
    permissions: account.permissions,
  });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const save = () => {
    setError(null);
    startTransition(async () => {
      const res = await updateAdminAccountPermissions(account.id, value);
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      toast.success('Permissions saved.');
      onSaved(res.account);
    });
  };

  return (
    <div className="flex max-w-xl flex-col gap-3 py-2">
      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
        What {account.displayName || account.email} can do
      </p>
      <PermissionMatrix value={value} onChange={setValue} disabled={isPending} />
      <div className="flex items-center gap-3">
        <Button size="sm" variant="primary" disabled={isPending} onClick={save}>
          {isPending ? 'Saving…' : 'Save permissions'}
        </Button>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">Changes apply right away.</p>
    </div>
  );
}

function ResetPasswordInline({
  accountId,
  onDone,
}: {
  accountId: string;
  onDone: () => void;
}) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const save = () => {
    setError(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    startTransition(async () => {
      const res = await resetAdminAccountPassword(accountId, password);
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      toast.success('Password reset.');
      onDone();
    });
  };

  return (
    <div className="flex flex-wrap items-end gap-3 py-1">
      <div className="flex min-w-[220px] flex-col gap-1">
        <Label>New password</Label>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
          autoComplete="new-password"
        />
      </div>
      <Button size="sm" variant="primary" disabled={isPending} onClick={save}>
        {isPending ? 'Saving…' : 'Save new password'}
      </Button>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

function CreateAdminForm({ onCreated }: { onCreated: (account: AdminAccount) => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [access, setAccess] = useState<PermissionValue>({ fullAccess: false, permissions: [] });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const next = () => {
    setError(null);
    if (!email.trim().includes('@')) {
      setError('Enter a valid email address.');
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    setStep(2);
  };

  const submit = () => {
    setError(null);
    if (!access.fullAccess && access.permissions.length === 0) {
      setError('Tick at least one permission, or choose Full access.');
      return;
    }
    startTransition(async () => {
      const res = await createAdminAccount({
        email: email.trim(),
        password,
        displayName: displayName.trim() || undefined,
        fullAccess: access.fullAccess,
        permissions: access.permissions,
      });
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      toast.success('Admin account created.');
      setEmail('');
      setPassword('');
      setDisplayName('');
      setAccess({ fullAccess: false, permissions: [] });
      setStep(1);
      onCreated(res.account);
    });
  };

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Add an admin</p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Step {step} of 2 · {step === 1 ? 'Details' : 'Permissions'}
        </p>
      </div>

      {step === 1 ? (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex min-w-[220px] flex-1 flex-col gap-1">
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teammate@uniscope.in"
                autoComplete="off"
              />
            </div>
            <div className="flex min-w-[180px] flex-col gap-1">
              <Label>Display name (optional)</Label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Priya"
              />
            </div>
            <div className="flex min-w-[220px] flex-col gap-1">
              <Label>Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                autoComplete="new-password"
              />
            </div>
            <Button variant="primary" onClick={next}>
              Next: permissions
            </Button>
          </div>
          <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-500">
            Anyone added here signs in with this exact email and password, on the same login screen as the
            root credential. There&rsquo;s no email invite step — hand the password to them yourself.
          </p>
        </>
      ) : (
        <div className="flex max-w-xl flex-col gap-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Choose what <span className="font-medium">{displayName.trim() || email.trim()}</span> can open and
            change in the admin panel.
          </p>
          <PermissionMatrix value={access} onChange={setAccess} disabled={isPending} />
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" disabled={isPending} onClick={() => setStep(1)}>
              Back
            </Button>
            <Button variant="primary" disabled={isPending} onClick={submit}>
              {isPending ? 'Creating…' : 'Create admin'}
            </Button>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </Card>
  );
}
