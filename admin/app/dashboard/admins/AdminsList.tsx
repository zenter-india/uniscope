'use client';

import { useState, useTransition } from 'react';
import { Badge, Button, Card, Input, Label, Table } from '../../../components/ui';
import { ConfirmButton } from '../../../components/ConfirmButton';
import { toast } from '../../../lib/toast';
import {
  createAdminAccount,
  resetAdminAccountPassword,
  setAdminAccountActive,
  type AdminAccount,
} from './actions';

const MIN_PASSWORD_LENGTH = 10;

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
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
}: {
  account: AdminAccount;
  isPending: boolean;
  onToggleActive: (id: string, isActive: boolean) => void;
}) {
  const [resetting, setResetting] = useState(false);

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
        <Table.Cell className="text-zinc-500 dark:text-zinc-400">{formatDate(account.lastLoginAt)}</Table.Cell>
        <Table.Cell className="text-zinc-500 dark:text-zinc-400">{formatDate(account.createdAt)}</Table.Cell>
        <Table.Cell>
          <div className="flex items-center gap-2">
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
      {resetting && (
        <Table.Row>
          <Table.Cell colSpan={6} className="bg-zinc-50/60 dark:bg-zinc-800/30">
            <ResetPasswordInline accountId={account.id} onDone={() => setResetting(false)} />
          </Table.Cell>
        </Table.Row>
      )}
    </>
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    setError(null);
    const trimmedEmail = email.trim();
    if (!trimmedEmail.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    startTransition(async () => {
      const res = await createAdminAccount({
        email: trimmedEmail,
        password,
        displayName: displayName.trim() || undefined,
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
      onCreated(res.account);
    });
  };

  return (
    <Card className="p-5">
      <p className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Add an admin</p>
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
        <Button variant="primary" disabled={isPending} onClick={submit}>
          {isPending ? 'Creating…' : 'Create admin'}
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
      <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-500">
        Anyone added here signs in with this exact email and password, on the same login screen as the
        root credential. There&rsquo;s no email invite step — hand the password to them yourself.
      </p>
    </Card>
  );
}
