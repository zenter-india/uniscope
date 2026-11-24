'use server';

import { backendFetch } from '../../../lib/backend';
import { moneyQueryString } from './days';
import type { MoneyQuery, MoneyTopup } from './types';

export type TopupsPage =
  | { ok: true; data: MoneyTopup[]; nextCursor: string | null }
  | { ok: false; error: string };

/** The next page of the top-ups table, for the same filters as the first one. */
export async function loadMoreTopups(
  query: MoneyQuery,
  cursor: string,
): Promise<TopupsPage> {
  try {
    const qs = new URLSearchParams(moneyQueryString(query));
    qs.set('cursor', cursor);
    const page = await backendFetch<{
      data: MoneyTopup[];
      nextCursor: string | null;
    }>(`/admin/money/topups?${qs.toString()}`);
    return { ok: true, ...page };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Could not load more top-ups',
    };
  }
}
