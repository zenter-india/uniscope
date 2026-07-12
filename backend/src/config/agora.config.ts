import { registerAs } from '@nestjs/config';

export interface AgoraConfig {
  appId: string;
  appCertificate: string;
}

export const agoraConfig = registerAs(
  'agora',
  (): AgoraConfig => ({
    appId: process.env['AGORA_APP_ID'] ?? '',
    appCertificate: process.env['AGORA_APP_CERTIFICATE'] ?? '',
  }),
);
