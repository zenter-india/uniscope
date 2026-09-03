'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { Button } from '../../../components/ui';
import { getSessionMessages, type ChatMessage } from './actions';

/**
 * Read-only chat transcript for a CHAT session. Fetches lazily on first
 * open; "Load older messages" pages up via the oldest message's id.
 * Renders standalone — the endpoint returns the two parties' names — so it
 * works both inside a session row and from a report about a session.
 */
export function SessionTranscript({
  sessionId,
  autoOpen = false,
}: {
  sessionId: string;
  autoOpen?: boolean;
}) {
  const [open, setOpen] = useState(autoOpen);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [parties, setParties] = useState<{
    aspirantId: string;
    aspirantName: string;
    mentorId: string;
    mentorName: string;
    sessionType: 'CHAT' | 'AUDIO_CALL';
  } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const autoRequested = useRef(false);

  const load = (before?: string) => {
    setErr(null);
    startTransition(async () => {
      try {
        const res = await getSessionMessages(sessionId, before);
        setMessages((prev) => (before ? [...res.messages, ...prev] : res.messages));
        setHasMore(res.hasMore);
        setParties({
          aspirantId: res.aspirantId,
          aspirantName: res.aspirantName,
          mentorId: res.mentorId,
          mentorName: res.mentorName,
          sessionType: res.sessionType,
        });
        setLoaded(true);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Could not load the transcript');
      }
    });
  };

  // When rendered already-open (e.g. from a report), fetch on mount.
  useEffect(() => {
    if (open && !autoRequested.current) {
      autoRequested.current = true;
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) {
    return (
      <Button
        size="sm"
        onClick={() => {
          autoRequested.current = true;
          setOpen(true);
          load();
        }}
      >
        View chat transcript
      </Button>
    );
  }

  return (
    <div className="max-w-xl">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Transcript
        </span>
        {!autoOpen && (
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-xs text-zinc-400 underline hover:text-zinc-600"
          >
            hide
          </button>
        )}
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}

      {loaded && parties?.sessionType === 'AUDIO_CALL' && (
        <p className="text-sm text-zinc-400">
          This was an audio call — there is no chat transcript.
        </p>
      )}
      {loaded && parties?.sessionType === 'CHAT' && messages.length === 0 && !err && (
        <p className="text-sm text-zinc-400">No messages in this conversation.</p>
      )}

      {messages.length > 0 && parties && (
        <div className="flex flex-col gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50/60 p-3">
          {hasMore && (
            <button
              type="button"
              onClick={() => load(messages[0].id)}
              disabled={isPending}
              className="mb-1 self-center text-xs text-zinc-500 underline hover:text-zinc-700 disabled:opacity-50"
            >
              {isPending ? 'Loading…' : 'Load older messages'}
            </button>
          )}
          {messages.map((msg) => {
            const fromMentor = msg.senderId === parties.mentorId;
            const fromAspirant = msg.senderId === parties.aspirantId;
            const who = fromAspirant
              ? parties.aspirantName
              : fromMentor
                ? parties.mentorName
                : 'UniScope Support';
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${fromMentor ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-2.5 py-1.5 text-sm ${
                    fromMentor
                      ? 'bg-zinc-900 text-white'
                      : 'border border-zinc-200 bg-white text-zinc-800'
                  }`}
                >
                  {msg.text}
                </div>
                <span className="mt-0.5 text-[11px] text-zinc-400">
                  {who} · {new Date(msg.createdAt).toLocaleString()}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
