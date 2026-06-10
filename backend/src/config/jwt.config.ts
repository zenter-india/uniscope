import { registerAs } from '@nestjs/config';

export interface JwtConfig {
  accessSecret: string;
  refreshSecret: string;
  /** Access token TTL in seconds (default: 900 = 15 min) */
  accessTtl: number;
  /** Refresh token TTL in seconds (default: 604800 = 7 days) */
  refreshTtl: number;
}

export const jwtConfig = registerAs(
  'jwt',
  (): JwtConfig => ({
    accessSecret: process.env['JWT_ACCESS_SECRET'] ?? 'change-me-access-secret',
    refreshSecret: process.env['JWT_REFRESH_SECRET'] ?? 'change-me-refresh-secret',
    accessTtl: parseInt(process.env['JWT_ACCESS_TTL'] ?? '900', 10),
    refreshTtl: parseInt(process.env['JWT_REFRESH_TTL'] ?? '604800', 10),
  }),
);
