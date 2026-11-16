'use server';

import { revalidatePath } from 'next/cache';
import { backendFetch } from '../../../lib/backend';

export type PromotionAudience = 'ALL' | 'ASPIRANT' | 'MENTOR' | 'SELECTED';

export interface Promotion {
  id: string;
  title: string;
  body: string | null;
  audience: string;
  linkUrl: string | null;
  linkLabel: string | null;
  /** Wallet credit per recipient, in minor units (1 Uniminute = 1000, 1 rupee = 100). */
  aspirantCreditMinor: number;
  mentorCreditMinor: number;
  recipientCount: number;
  creditedCount: number;
  seenCount: number;
  createdAt: string;
}

export interface PickableUser {
  id: string;
  displayName: string;
  role: string;
  uniqueId: string | null;
  /** Banned or deactivated accounts can be found but not picked. */
  eligible: boolean;
}

export interface PromotionReach {
  recipientCount: number;
  aspirantCount: number;
  mentorCount: number;
}

export async function listPromotions(): Promise<Promotion[]> {
  return backendFetch<Promotion[]>('/admin/promotions');
}

export async function previewPromotion(
  audience: PromotionAudience,
  userIds: string[],
): Promise<PromotionReach> {
  const params = new URLSearchParams({ audience });
  if (audience === 'SELECTED') params.set('userIds', userIds.join(','));
  return backendFetch<PromotionReach>(`/admin/promotions/preview?${params.toString()}`);
}

/** Search for a person to send a promotion to. Admins are left out. */
export async function searchPromotionUsers(query: string): Promise<PickableUser[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const res = await backendFetch<{
    data: {
      id: string;
      displayName: string;
      role: string;
      uniqueId: string | null;
      isActive: boolean;
      isBanned: boolean;
    }[];
  }>(`/users?search=${encodeURIComponent(q)}&limit=10`);
  return res.data
    .filter((u) => u.role !== 'ADMIN')
    .map((u) => ({
      id: u.id,
      displayName: u.displayName,
      role: u.role,
      uniqueId: u.uniqueId,
      eligible: u.isActive && !u.isBanned,
    }));
}

type Result = { ok: true; promotion: Promotion } | { ok: false; error: string };

export async function sendPromotion(input: {
  title: string;
  body: string;
  audience: PromotionAudience;
  userIds: string[];
  linkUrl: string;
  linkLabel: string;
  aspirantUniminutes: number;
  mentorRupees: number;
}): Promise<Result> {
  try {
    const promotion = await backendFetch<Promotion>('/admin/promotions', {
      method: 'POST',
      body: JSON.stringify({
        title: input.title,
        body: input.body || undefined,
        audience: input.audience,
        userIds: input.audience === 'SELECTED' ? input.userIds : undefined,
        linkUrl: input.linkUrl || undefined,
        linkLabel: input.linkUrl && input.linkLabel ? input.linkLabel : undefined,
        aspirantUniminutes: input.aspirantUniminutes || undefined,
        mentorRupees: input.mentorRupees || undefined,
      }),
    });
    revalidatePath('/dashboard/promotions');
    return { ok: true, promotion };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Could not send the promotion',
    };
  }
}
