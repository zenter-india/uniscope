import { apiClient } from './client';
import type { AuthUser } from '../store/useAuthStore';

export interface VerifyOtpResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser & { isNewUser: boolean };
}

export async function requestOtp(phone: string): Promise<{ serviceId: string }> {
  const { data } = await apiClient.post<{ serviceId: string }>('/auth/otp/request', { phone });
  return data;
}

export async function verifyOtp(
  serviceId: string,
  phone: string,
  code: string,
): Promise<VerifyOtpResponse> {
  const { data } = await apiClient.post<VerifyOtpResponse>('/auth/otp/verify', {
    serviceId,
    phone,
    code,
  });
  return data;
}

export async function refreshTokenApi(
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const { data } = await apiClient.post<{
    accessToken: string;
    refreshToken: string;
  }>('/auth/token/refresh', { refreshToken });
  return data;
}

export async function logoutApi(): Promise<void> {
  await apiClient.post('/auth/logout');
}
