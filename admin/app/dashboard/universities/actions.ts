'use server';

import { revalidatePath } from 'next/cache';
import { backendFetch } from '../../../lib/backend';

export interface UniversityInput {
  name: string;
  type: string;
  state: string;
  city: string | null;
  nirfRank?: number;
  mbbsSeats?: number;
  establishedYear?: number;
  website?: string;
  description?: string;
}

export async function createUniversity(input: UniversityInput): Promise<void> {
  await backendFetch('/universities', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  revalidatePath('/dashboard/universities');
}

export async function updateUniversity(
  id: string,
  input: Partial<UniversityInput> & { isActive?: boolean },
): Promise<void> {
  await backendFetch(`/universities/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  revalidatePath('/dashboard/universities');
}

export async function uploadUniversityPhoto(id: string, imageBase64: string): Promise<void> {
  await backendFetch(`/universities/${id}/photo`, {
    method: 'POST',
    body: JSON.stringify({ imageBase64 }),
  });
  revalidatePath('/dashboard/universities');
}
