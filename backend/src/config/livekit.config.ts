import { registerAs } from '@nestjs/config';

export interface LivekitConfig {
  /** wss:// URL of the LiveKit Cloud project (Mumbai/ap-south region) — the
   * client SDK connects directly to this, distinct from the API key/secret
   * pair used only for server-side token signing. */
  serverUrl: string;
  apiKey: string;
  apiSecret: string;
}

export const livekitConfig = registerAs(
  'livekit',
  (): LivekitConfig => ({
    serverUrl: process.env['LIVEKIT_URL'] ?? '',
    apiKey: process.env['LIVEKIT_API_KEY'] ?? '',
    apiSecret: process.env['LIVEKIT_API_SECRET'] ?? '',
  }),
);
