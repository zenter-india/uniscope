import { registerAs } from '@nestjs/config';

export interface StreamConfig {
  apiKey: string;
  apiSecret: string;
}

export const streamConfig = registerAs(
  'stream',
  (): StreamConfig => ({
    apiKey: process.env['STREAM_API_KEY'] ?? '',
    apiSecret: process.env['STREAM_API_SECRET'] ?? '',
  }),
);
