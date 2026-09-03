'use server';

import { revalidatePath } from 'next/cache';
import { backendFetch } from '../../../lib/backend';

export interface SessionRowData {
  id: string;
  aspirantId: string;
  mentorId: string;
  aspirantName: string;
  mentorName: string;
  type: 'CHAT' | 'AUDIO_CALL';
  status:
    | 'PENDING'
    | 'ACCEPTED'
    | 'REJECTED'
    | 'RINGING'
    | 'IN_PROGRESS'
    | 'COMPLETED'
    | 'CANCELLED'
    | 'EXPIRED'
    | 'FAILED';
  ratePerMinuteMinor: number;
  requestedAt: string;
  respondedAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  billedMinutes: number;
  totalCostMinor: number;
  endReason: string | null;
  callSlotMinutes: number | null;
  aspirantJoinedAt: string | null;
  mentorJoinedAt: string | null;
  createdAt: string;
}

export interface SessionListFilters {
  status?: string;
  type?: string;
  search?: string;
}

export async function loadMoreSessions(
  filters: SessionListFilters,
  cursor: string,
): Promise<{ data: SessionRowData[]; nextCursor: string | null }> {
  const params = new URLSearchParams({ limit: '25', cursor });
  if (filters.status && filters.status !== 'ALL') params.set('status', filters.status);
  if (filters.type && filters.type !== 'ALL') params.set('type', filters.type);
  if (filters.search) params.set('search', filters.search);

  return backendFetch<{ data: SessionRowData[]; nextCursor: string | null }>(
    `/sessions/admin/all?${params.toString()}`,
  );
}

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  createdAt: string;
}

export interface SessionTranscriptPage {
  messages: ChatMessage[];
  hasMore: boolean;
  sessionType: 'CHAT' | 'AUDIO_CALL';
  aspirantId: string;
  aspirantName: string;
  mentorId: string;
  mentorName: string;
}

/** The chat transcript for a session, with the two parties' names so it can
 * render standalone (e.g. from a report). Non-chat sessions and never-opened
 * chats come back with an empty `messages`. `before` is an older message id
 * for paging up. */
export async function getSessionMessages(
  sessionId: string,
  before?: string,
): Promise<SessionTranscriptPage> {
  const qs = before ? `?before=${encodeURIComponent(before)}` : '';
  return backendFetch<SessionTranscriptPage>(
    `/sessions/admin/${sessionId}/messages${qs}`,
  );
}

type Result = { ok: true; status: string } | { ok: false; error: string };

/** Force a stuck session to a terminal state and release any active hold.
 * Returns the reason on failure instead of throwing, so the admin sees it. */
export async function forceEndSession(id: string): Promise<Result> {
  try {
    const res = await backendFetch<{ status: string }>(`/sessions/admin/${id}/force-end`, {
      method: 'POST',
    });
    revalidatePath('/dashboard/sessions');
    revalidatePath('/dashboard');
    return { ok: true, status: res.status };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Could not force-end the session',
    };
  }
}
