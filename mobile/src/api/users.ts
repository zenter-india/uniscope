import { apiClient } from './client';
import type { AuthUser, UserRole } from '../store/useAuthStore';

export interface UserProfile extends AuthUser {
  verificationStatus: string;
  isActive: boolean;
  createdAt: string;
}

export async function getMe(): Promise<UserProfile> {
  const { data } = await apiClient.get<UserProfile>('/users/me');
  return data;
}

export async function updateRole(role: UserRole): Promise<UserProfile> {
  const { data } = await apiClient.patch<UserProfile>('/users/me/role', { role });
  return data;
}

export async function updateProfile(payload: {
  displayName?: string;
  bio?: string;
}): Promise<UserProfile> {
  const { data } = await apiClient.patch<UserProfile>('/users/me', payload);
  return data;
}

export async function storePushToken(
  token: string,
  platform: 'ios' | 'android',
): Promise<void> {
  await apiClient.post('/users/me/push-token', { token, platform });
}
