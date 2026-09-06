'use server';

import { backendFetch } from '../../../lib/backend';

export interface SupportChannelSummary {
  channelId: string;
  userId: string;
  displayName: string;
  uniqueId: string | null;
  role: string | null;
  messageCount: number;
  lastMessageText: string | null;
  lastMessageAt: string;
  lastMessageFromStaff: boolean;
  awaitingReply: boolean;
}

export interface SupportMessage {
  id: string;
  channelId: string;
  senderId: string;
  text: string;
  createdAt: string;
}

export interface SupportThread {
  channelId: string;
  messages: SupportMessage[];
  hasMore: boolean;
}

export async function listSupportChannels(): Promise<SupportChannelSummary[]> {
  return backendFetch<SupportChannelSummary[]>('/admin/support');
}

export async function getSupportThread(
  userId: string,
  before?: string,
): Promise<SupportThread> {
  const qs = before ? `?before=${encodeURIComponent(before)}` : '';
  return backendFetch<SupportThread>(
    `/admin/support/${encodeURIComponent(userId)}/messages${qs}`,
  );
}

type ReplyResult =
  | { ok: true; message: SupportMessage }
  | { ok: false; error: string };

export async function sendSupportReply(
  userId: string,
  text: string,
): Promise<ReplyResult> {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: 'Message is empty' };
  try {
    const message = await backendFetch<SupportMessage>(
      `/admin/support/${encodeURIComponent(userId)}/messages`,
      {
        method: 'POST',
        body: JSON.stringify({
          text: trimmed,
          clientMessageId: crypto.randomUUID(),
        }),
      },
    );
    return { ok: true, message };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Could not send the reply',
    };
  }
}

// ── Technical reports ("Report a technical issue" from the Help Centre) ──

export interface TechnicalReport {
  id: string;
  message: string;
  platform: string | null;
  appVersion: string | null;
  status: 'OPEN' | 'RESOLVED';
  adminNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
  reporter: { displayName: string; uniqueId: string | null; role: string } | null;
}

export async function listTechnicalReports(
  status?: 'OPEN' | 'RESOLVED',
): Promise<{ data: TechnicalReport[]; nextCursor: string | null }> {
  const qs = status ? `?status=${status}` : '';
  return backendFetch<{ data: TechnicalReport[]; nextCursor: string | null }>(
    `/admin/technical-reports${qs}`,
  );
}

type ResolveResult =
  | { ok: true; report: TechnicalReport }
  | { ok: false; error: string };

export async function setTechnicalReportStatus(
  id: string,
  status: 'OPEN' | 'RESOLVED',
  adminNote?: string,
): Promise<ResolveResult> {
  try {
    const report = await backendFetch<TechnicalReport>(
      `/admin/technical-reports/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status, adminNote: adminNote ?? undefined }),
      },
    );
    return { ok: true, report };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Could not update the report',
    };
  }
}
