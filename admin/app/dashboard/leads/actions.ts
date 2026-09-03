'use server';

import { revalidatePath } from 'next/cache';
import { backendFetch } from '../../../lib/backend';
import type { LeadRowData } from './LeadRow';

export interface LeadListFilters {
  role: string;
  status: string;
  search?: string;
  sort?: string;
  dir?: string;
}

/** Next page of the enrollment-lead list — same filters as the page, plus a
 * cursor. Drives the "Load more" button in LeadsList. */
export async function loadMoreLeads(
  filters: LeadListFilters,
  cursor: string,
): Promise<{ data: LeadRowData[]; nextCursor: string | null }> {
  const params = new URLSearchParams({ limit: '100', cursor });
  if (filters.role !== 'ALL') params.set('role', filters.role);
  if (filters.status !== 'ALL') params.set('status', filters.status);
  if (filters.search) params.set('search', filters.search);
  if (filters.sort) params.set('sortBy', filters.sort);
  if (filters.dir) params.set('sortDir', filters.dir);

  return backendFetch<{ data: LeadRowData[]; nextCursor: string | null }>(
    `/enrollments?${params.toString()}`,
  );
}

export async function getLeadDocumentUrl(leadId: string): Promise<string> {
  const { url } = await backendFetch<{ url: string }>(`/enrollments/${leadId}/document-url`);
  return url;
}

export async function updateLead(
  leadId: string,
  patch: { status?: string; adminNote?: string },
): Promise<void> {
  await backendFetch(`/enrollments/${leadId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  revalidatePath('/dashboard/leads');
  revalidatePath('/dashboard');
}
