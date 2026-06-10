import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { RedisConfig } from '../config/index.js';

export const REDIS_CLIENT = 'REDIS_CLIENT';

export const redisProvider = {
  provide: REDIS_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService): Redis => {
    const cfg = config.get<RedisConfig>('redis')!;
    const client = new Redis({
      host: cfg.host,
      port: cfg.port,
      password: cfg.password || undefined,
      lazyConnect: false,
      maxRetriesPerRequest: 3,
    });

    client.on('error', (err) => {
      console.error('[Redis] connection error:', err.message);
    });

    return client;
  },
};
