'use server';

import { revalidatePath } from 'next/cache';
import { backendFetch } from '../../../lib/backend';

export interface DiffItem {
  key: string;
  name: string;
  detail: string;
  confidence?: 'high' | 'medium';
}

export interface DataImportJob {
  id: string;
  type: 'UG' | 'PG';
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'APPLIED';
  diffJson: {
    added: DiffItem[];
    changed: DiffItem[];
    unchanged: number;
    sourceCount: number;
  } | null;
  appliedJson: { addedKeys: string[]; changedKeys: string[] } | null;
  error: string | null;
  startedAt: string;
  completedAt: string | null;
  appliedAt: string | null;
  appliedBy: string | null;
}

export async function listJobs(): Promise<DataImportJob[]> {
  return backendFetch<DataImportJob[]>('/admin/data-import');
}

export async function runImport(type: 'UG' | 'PG'): Promise<DataImportJob> {
  const job = await backendFetch<DataImportJob>(`/admin/data-import/${type}/run`, {
    method: 'POST',
  });
  revalidatePath('/dashboard/data-import');
  return job;
}

export async function getJob(id: string): Promise<DataImportJob> {
  return backendFetch<DataImportJob>(`/admin/data-import/${id}`);
}

export async function applyJob(id: string, approvedKeys: string[]): Promise<DataImportJob> {
  const job = await backendFetch<DataImportJob>(`/admin/data-import/${id}/apply`, {
    method: 'POST',
    body: JSON.stringify({ approvedKeys }),
  });
  revalidatePath('/dashboard/data-import');
  revalidatePath('/dashboard/universities');
  return job;
}
