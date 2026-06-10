import { registerAs } from '@nestjs/config';

export interface RedisConfig {
  host: string;
  port: number;
  password: string;
  /** OTP TTL in seconds (default: 600 = 10 min) */
  otpTtl: number;
}

export const redisConfig = registerAs(
  'redis',
  (): RedisConfig => ({
    host: process.env['REDIS_HOST'] ?? 'localhost',
    port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
    password: process.env['REDIS_PASSWORD'] ?? '',
    otpTtl: parseInt(process.env['REDIS_OTP_TTL'] ?? '600', 10),
  }),
);
