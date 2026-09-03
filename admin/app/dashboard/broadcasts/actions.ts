'use server';

import { revalidatePath } from 'next/cache';
import { backendFetch } from '../../../lib/backend';

export type BroadcastAudience = 'ALL' | 'ASPIRANT' | 'MENTOR';

export interface Broadcast {
  id: string;
  title: string;
  body: string | null;
  audience: string;
  recipientCount: number;
  createdAt: string;
}

export async function listBroadcasts(): Promise<Broadcast[]> {
  return backendFetch<Broadcast[]>('/admin/broadcasts');
}

export async function previewRecipients(
  audience: BroadcastAudience,
): Promise<number> {
  const res = await backendFetch<{ recipientCount: number }>(
    `/admin/broadcasts/preview?audience=${audience}`,
  );
  return res.recipientCount;
}

type Result = { ok: true; broadcast: Broadcast } | { ok: false; error: string };

export async function sendBroadcast(input: {
  title: string;
  body: string;
  audience: BroadcastAudience;
}): Promise<Result> {
  try {
    const broadcast = await backendFetch<Broadcast>('/admin/broadcasts', {
      method: 'POST',
      body: JSON.stringify({
        title: input.title,
        body: input.body || undefined,
        audience: input.audience,
      }),
    });
    revalidatePath('/dashboard/broadcasts');
    return { ok: true, broadcast };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Could not send the announcement',
    };
  }
}
