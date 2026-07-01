import { registerAs } from '@nestjs/config';

export interface StreamConfig {
  appId: string;
  apiKey: string;
  apiSecret: string;
}

export const streamConfig = registerAs(
  'stream',
  (): StreamConfig => ({
    appId: process.env['STREAM_APP_ID'] ?? '',
    apiKey: process.env['STREAM_API_KEY'] ?? '',
    apiSecret: process.env['STREAM_API_SECRET'] ?? '',
  }),
);
