'use server';

import { backendFetch } from '../../lib/backend';

export interface GlobalSearchResult {
  users: {
    id: string;
    displayName: string;
    role: string;
    verificationStatus: string;
    isBanned: boolean;
  }[];
  universities: {
    id: string;
    name: string;
    slug: string;
    state: string;
    city: string | null;
    isActive: boolean;
  }[];
}

const EMPTY: GlobalSearchResult = { users: [], universities: [] };

/** Header search box — cross-entity quick lookup (users + universities). */
export async function globalSearch(q: string): Promise<GlobalSearchResult> {
  const query = q.trim();
  if (query.length < 2) return EMPTY;
  try {
    return await backendFetch<GlobalSearchResult>(
      `/admin/search?q=${encodeURIComponent(query)}`,
    );
  } catch {
    return EMPTY;
  }
}
