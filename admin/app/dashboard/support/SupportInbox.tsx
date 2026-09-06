'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { Badge, Button, Card, Textarea } from '../../../components/ui';
import { Icon } from '../../../components/icons';
import {
  getSupportThread,
  listSupportChannels,
  sendSupportReply,
  type SupportChannelSummary,
  type SupportMessage,
} from './actions';
import { SUPPORT_ACCOUNT_ID } from './constants';

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function SupportInbox({
  initialChannels,
}: {
  initialChannels: SupportChannelSummary[];
}) {
  const [channels, setChannels] = useState(initialChannels);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(
    initialChannels[0]?.userId ?? null,
  );
  const [refreshing, startRefresh] = useTransition();

  const refreshChannels = useCallback(() => {
    startRefresh(async () => {
      try {
        setChannels(await listSupportChannels());
      } catch {
        /* keep stale list on failure */
      }
    });
  }, []);

  const selected = channels.find((c) => c.userId === selectedUserId) ?? null;

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <Card className="flex max-h-[calc(100vh-180px)] flex-col overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
          <span className="text-sm font-semibold text-zinc-900">
            Conversations
            <span className="ml-1.5 text-xs font-normal text-zinc-400">
              {channels.length}
            </span>
          </span>
          <button
            onClick={refreshChannels}
            disabled={refreshing}
            className="text-zinc-400 transition hover:text-zinc-700 disabled:opacity-40"
            title="Refresh"
          >
            <Icon.refresh width={15} height={15} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {channels.length === 0 ? (
            <p className="p-4 text-sm text-zinc-500">No support conversations yet.</p>
          ) : (
            channels.map((c) => (
              <button
                key={c.channelId}
                onClick={() => setSelectedUserId(c.userId)}
                className={`flex w-full flex-col gap-1 border-b border-zinc-100 px-4 py-3 text-left transition hover:bg-zinc-50 ${
                  c.userId === selectedUserId ? 'bg-zinc-50' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-zinc-900">
                    {c.displayName}
                  </span>
                  {c.role && (
                    <Badge tone={c.role === 'MENTOR' ? 'success' : 'neutral'}>
                      {c.role === 'MENTOR' ? 'Mentor' : 'Student'}
                    </Badge>
                  )}
                  {c.awaitingReply && (
                    <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-amber-500" title="Awaiting reply" />
                  )}
                </div>
                <span className="truncate text-xs text-zinc-500">
                  {c.lastMessageFromStaff ? 'You: ' : ''}
                  {c.lastMessageText ?? '—'}
                </span>
                <span className="text-[11px] text-zinc-400">
                  {timeAgo(c.lastMessageAt)} · {c.messageCount} message
                  {c.messageCount === 1 ? '' : 's'}
                </span>
              </button>
            ))
          )}
        </div>
      </Card>

      {selected ? (
        <ThreadView
          key={selected.userId}
          channel={selected}
          onReplied={refreshChannels}
        />
      ) : (
        <Card className="flex items-center justify-center p-10 text-sm text-zinc-500">
          Select a conversation to view it.
        </Card>
      )}
    </div>
  );
}

function ThreadView({
  channel,
  onReplied,
}: {
  channel: SupportChannelSummary;
  onReplied: () => void;
}) {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sendErr, setSendErr] = useState<string | null>(null);
  const [sending, startSend] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadOlder = useCallback(
    (before: string) => {
      getSupportThread(channel.userId, before)
        .then((t) => {
          setMessages((prev) => [...t.messages, ...prev]);
          setHasMore(t.hasMore);
        })
        .catch(() => {
          /* keep what we have; the button stays available to retry */
        });
    },
    [channel.userId],
  );

  // ThreadView is remounted per thread (key={userId} in the parent), so
  // `loading` starts true and this runs exactly once on mount.
  useEffect(() => {
    let cancelled = false;
    getSupportThread(channel.userId)
      .then((t) => {
        if (cancelled) return;
        setMessages(t.messages);
        setHasMore(t.hasMore);
        setLoadErr(null);
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setLoadErr(e instanceof Error ? e.message : 'Could not load the thread');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [channel.userId]);

  useEffect(() => {
    if (!loading) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [loading, messages.length]);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    setSendErr(null);
    startSend(async () => {
      const res = await sendSupportReply(channel.userId, text);
      if (!res.ok) {
        setSendErr(res.error);
        return;
      }
      setMessages((prev) => [...prev, res.message]);
      setDraft('');
      onReplied();
    });
  };

  return (
    <Card className="flex max-h-[calc(100vh-180px)] flex-col overflow-hidden p-0">
      <div className="border-b border-zinc-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-zinc-900">
            {channel.displayName}
          </span>
          {channel.role && (
            <Badge tone={channel.role === 'MENTOR' ? 'success' : 'neutral'}>
              {channel.role === 'MENTOR' ? 'Mentor' : 'Student'}
            </Badge>
          )}
        </div>
        {channel.uniqueId && (
          <span className="text-xs text-zinc-400">{channel.uniqueId}</span>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-zinc-50 p-4">
        {loading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : loadErr ? (
          <p className="text-sm text-red-600">{loadErr}</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-zinc-500">No messages in this conversation.</p>
        ) : (
          <>
            {hasMore && (
              <div className="text-center">
                <Button
                  size="sm"
                  onClick={() => {
                    const oldest = messages[0]?.id;
                    if (oldest) loadOlder(oldest);
                  }}
                >
                  Load older messages
                </Button>
              </div>
            )}
            {messages.map((m) => {
              const staff = m.senderId === SUPPORT_ACCOUNT_ID;
              return (
                <div
                  key={m.id}
                  className={`flex ${staff ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm ${
                      staff
                        ? 'rounded-br-sm bg-emerald-600 text-white'
                        : 'rounded-bl-sm border border-zinc-200 bg-white text-zinc-800'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.text}</p>
                    <p
                      className={`mt-1 text-[10px] ${
                        staff ? 'text-emerald-100' : 'text-zinc-400'
                      }`}
                    >
                      {staff ? 'Support' : channel.displayName} ·{' '}
                      {new Date(m.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      <div className="border-t border-zinc-200 p-3">
        {sendErr && <p className="mb-2 text-sm text-red-600">{sendErr}</p>}
        <div className="flex items-end gap-2">
          <Textarea
            rows={2}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Reply as UniScope Support…  (⌘/Ctrl + Enter to send)"
            className="flex-1"
          />
          <Button
            variant="primary"
            onClick={send}
            disabled={sending || !draft.trim()}
          >
            {sending ? 'Sending…' : 'Send'}
          </Button>
        </div>
      </div>
    </Card>
  );
}
