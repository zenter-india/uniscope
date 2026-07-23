import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import type { RedisConfig } from '../../config/index.js';
import { REDIS_CLIENT } from '../../redis/index.js';
import type { OtpProvider } from './otp-provider.interface.js';

const OTP_RATE_LIMIT = 5;
const RATE_LIMIT_WINDOW = 3600; // 1 hour in seconds

/** Fixed dev-only code — mock mode never sends a real SMS, so a stable code
 * lets you log in on any device without asking someone else to read it out
 * of the server logs each time. Never used when OTP_PROVIDER_TYPE=twilio. */
export const MOCK_OTP_FIXED_CODE = '111111';

@Injectable()
export class MockOtpProvider implements OtpProvider {
  private readonly otpTtl: number;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly config: ConfigService,
  ) {
    this.otpTtl = this.config.get<RedisConfig>('redis')!.otpTtl;
  }

  private sha256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private normalisePhone(phone: string): string {
    return phone.replace(/\s+/g, '').trim();
  }

  async sendOtp(phone: string): Promise<{ serviceId: string }> {
    const normalised = this.normalisePhone(phone);
    const phoneHash = this.sha256(normalised);

    const rateLimitKey = `otp:ratelimit:${phoneHash}`;
    const currentCount = await this.redis.incr(rateLimitKey);

    if (currentCount === 1) {
      await this.redis.expire(rateLimitKey, RATE_LIMIT_WINDOW);
    }

    if (currentCount > OTP_RATE_LIMIT) {
      throw new HttpException(
        'Too many OTP requests. Please try again in an hour.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const otp = MOCK_OTP_FIXED_CODE;
    const serviceId = uuidv4();

    await this.redis.set(
      `otp:${serviceId}`,
      JSON.stringify({ otp, phoneHash }),
      'EX',
      this.otpTtl,
    );

    console.log(`[OTP Mock] ${normalised}: ${otp}`);

    return { serviceId };
  }

  async verifyOtp(phone: string, code: string, serviceId: string): Promise<boolean> {
    const raw = await this.redis.get(`otp:${serviceId}`);

    if (!raw) {
      throw new UnauthorizedException('OTP expired or invalid');
    }

    const stored = JSON.parse(raw) as { otp: string; phoneHash: string };

    if (stored.otp !== code) {
      throw new UnauthorizedException('OTP expired or invalid');
    }

    // One-time use — delete immediately
    await this.redis.del(`otp:${serviceId}`);

    return true;
  }

  /**
   * Returns the phone hash for a verified serviceId.
   * Used by AuthService to look up or create the user after mock OTP verification.
   */
  async getPhoneHashForServiceId(serviceId: string): Promise<string> {
    const raw = await this.redis.get(`otp:${serviceId}`);
    if (!raw) {
      throw new UnauthorizedException('OTP session not found');
    }
    const stored = JSON.parse(raw) as { otp: string; phoneHash: string };
    return stored.phoneHash;
  }

  sha256Public(value: string): string {
    return this.sha256(value);
  }

  normalisePhonePublic(phone: string): string {
    return this.normalisePhone(phone);
  }
}
