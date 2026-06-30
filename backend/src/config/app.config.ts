import { registerAs } from '@nestjs/config';

export interface AppConfig {
  port: number;
  nodeEnv: string;
  appName: string;
  apiPrefix: string;
}

export const appConfig = registerAs(
  'app',
  (): AppConfig => ({
    port: parseInt(process.env['PORT'] ?? '3000', 10),
    nodeEnv: process.env['NODE_ENV'] ?? 'development',
    appName: process.env['APP_NAME'] ?? 'MedConnect API',
    apiPrefix: process.env['API_PREFIX'] ?? 'api/v1',
  }),
);
