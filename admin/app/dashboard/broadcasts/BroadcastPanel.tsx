'use client';

import { useEffect, useState, useTransition } from 'react';
import { Badge, Button, Card, fieldClass } from '../../../components/ui';
import {
  previewRecipients,
  sendBroadcast,
  type Broadcast,
  type BroadcastAudience,
} from './actions';

const AUDIENCE_OPTIONS: { value: BroadcastAudience; label: string }[] = [
  { value: 'ALL', label: 'All users (students + mentors)' },
  { value: 'ASPIRANT', label: 'Students only' },
  { value: 'MENTOR', label: 'Mentors only' },
];

const AUDIENCE_LABEL: Record<string, string> = {
  ALL: 'All users',
  ASPIRANT: 'Students',
  MENTOR: 'Mentors',
};

const TITLE_MAX = 120;
const BODY_MAX = 500;

export function BroadcastPanel({ initialHistory }: { initialHistory: Broadcast[] }) {
  const [history, setHistory] = useState(initialHistory);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<BroadcastAudience>('ALL');

  const [count, setCount] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Refresh the "will reach N people" hint whenever the audience changes.
  useEffect(() => {
    let cancelled = false;
    previewRecipients(audience)
      .then((n) => {
        if (!cancelled) setCount(n);
      })
      .catch(() => {
        if (!cancelled) setCount(null);
      });
    return () => {
      cancelled = true;
    };
  }, [audience]);

  const trimmedTitle = title.trim();
  const canSend = trimmedTitle.length > 0 && !isPending;

  const doSend = () => {
    setError(null);
    startTransition(async () => {
      const res = await sendBroadcast({ title: trimmedTitle, body: body.trim(), audience });
      if (!res.ok) {
        setError(res.error);
        setConfirming(false);
        return;
      }
      setHistory((prev) => [res.broadcast, ...prev]);
      setSent(
        `Sent to ${res.broadcast.recipientCount.toLocaleString()} ${
          AUDIENCE_LABEL[res.broadcast.audience] ?? res.broadcast.audience
        }.`,
      );
      setTitle('');
      setBody('');
      setConfirming(false);
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-5">
        <h2 className="text-sm font-semibold text-zinc-900">New announcement</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Sends an in-app notification (and a push, where the user has the app installed) to
          every active account in the audience. Banned and deleted accounts are skipped. This
          can&apos;t be recalled once sent.
        </p>

        <div className="mt-4 flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">
              Title
            </span>
            <input
              className={fieldClass}
              value={title}
              maxLength={TITLE_MAX}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Scheduled maintenance tonight"
            />
            <span className="self-end text-[11px] text-zinc-400">
              {title.length}/{TITLE_MAX}
            </span>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">
              Message <span className="normal-case text-zinc-400">(optional)</span>
            </span>
            <textarea
              className={fieldClass}
              rows={3}
              value={body}
              maxLength={BODY_MAX}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Add detail here. Keep it short — it shows as a notification."
            />
            <span className="self-end text-[11px] text-zinc-400">
              {body.length}/{BODY_MAX}
            </span>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">
              Audience
            </span>
            <select
              className={`${fieldClass} max-w-sm`}
              value={audience}
              onChange={(e) => {
                setCount(null);
                setAudience(e.target.value as BroadcastAudience);
              }}
            >
              {AUDIENCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <span className="text-xs text-zinc-500">
              {count === null
                ? 'Counting recipients…'
                : `Will notify ${count.toLocaleString()} ${
                    count === 1 ? 'person' : 'people'
                  }.`}
            </span>
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {sent && !error && <p className="text-sm text-emerald-600">{sent}</p>}

          {confirming ? (
            <div className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm text-amber-900">
                Send &ldquo;<span className="font-semibold">{trimmedTitle}</span>&rdquo; to{' '}
                <span className="font-semibold">
                  {count?.toLocaleString() ?? 'all'} {AUDIENCE_LABEL[audience]}
                </span>
                ? This notifies everyone immediately and can&apos;t be undone.
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  onClick={doSend}
                  disabled={isPending}
                >
                  {isPending ? 'Sending…' : 'Send now'}
                </Button>
                <Button size="sm" onClick={() => setConfirming(false)} disabled={isPending}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <Button
                variant="primary"
                onClick={() => {
                  setError(null);
                  setSent(null);
                  setConfirming(true);
                }}
                disabled={!canSend}
              >
                Review &amp; send
              </Button>
            </div>
          )}
        </div>
      </Card>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-zinc-900">Recent announcements</h2>
        {history.length === 0 ? (
          <p className="text-sm text-zinc-500">Nothing sent yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {history.map((b) => (
              <Card key={b.id} className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-zinc-900">{b.title}</span>
                  <Badge>{AUDIENCE_LABEL[b.audience] ?? b.audience}</Badge>
                  <span className="text-xs text-zinc-400">
                    {b.recipientCount.toLocaleString()} recipients
                  </span>
                </div>
                {b.body && <p className="mt-1 text-sm text-zinc-600">{b.body}</p>}
                <p className="mt-1 text-xs text-zinc-400">
                  {new Date(b.createdAt).toLocaleString()}
                </p>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
