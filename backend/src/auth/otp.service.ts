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
import type { RedisConfig } from '../config/index.js';
import { REDIS_CLIENT } from '../redis/index.js';

const OTP_RATE_LIMIT = 5;
const RATE_LIMIT_WINDOW = 3600; // 1 hour in seconds

@Injectable()
export class OtpService {
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

  async requestOtp(phone: string): Promise<{ requestId: string }> {
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

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const requestId = uuidv4();

    await this.redis.set(
      `otp:${requestId}`,
      JSON.stringify({ otp, phoneHash }),
      'EX',
      this.otpTtl,
    );

    // Sprint 1: mock SMS — log to console
    console.log(`[OTP] ${normalised}: ${otp}`);

    return { requestId };
  }

  async verifyOtp(
    requestId: string,
    otp: string,
  ): Promise<{ phoneHash: string }> {
    const raw = await this.redis.get(`otp:${requestId}`);

    if (!raw) {
      throw new UnauthorizedException('OTP expired or invalid');
    }

    const stored = JSON.parse(raw) as { otp: string; phoneHash: string };

    if (stored.otp !== otp) {
      throw new UnauthorizedException('OTP expired or invalid');
    }

    // One-time use — delete immediately
    await this.redis.del(`otp:${requestId}`);

    return { phoneHash: stored.phoneHash };
  }
}
