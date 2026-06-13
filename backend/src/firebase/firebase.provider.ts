import * as fs from 'node:fs';
import * as path from 'node:path';
import { Logger, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { FIREBASE_APP } from './firebase.constants.js';

const logger = new Logger('FirebaseProvider');

/**
 * Factory provider that initialises the Firebase Admin SDK.
 * In local development (FIREBASE_DISABLED=true or missing service account file),
 * the provider returns null instead of crashing — FCM features are simply unavailable.
 */
export const firebaseProvider: Provider = {
  provide: FIREBASE_APP,
  inject: [ConfigService],
  useFactory: (configService: ConfigService): App | null => {
    const existingApps = getApps();
    if (existingApps.length > 0) {
      return existingApps[0] as App;
    }

    const disabled = configService.get<string>('FIREBASE_DISABLED');
    if (disabled === 'true') {
      logger.warn('Firebase is disabled (FIREBASE_DISABLED=true). Push notifications unavailable.');
      return null;
    }

    const projectId = configService.getOrThrow<string>('firebase.projectId');
    const keyPath = configService.getOrThrow<string>('firebase.serviceAccountKeyPath');
    const resolvedPath = path.isAbsolute(keyPath) ? keyPath : path.resolve(process.cwd(), keyPath);

    if (!fs.existsSync(resolvedPath)) {
      logger.warn(
        `Firebase service account not found at ${resolvedPath}. Push notifications unavailable.`,
      );
      return null;
    }

    const serviceAccountJson = JSON.parse(fs.readFileSync(resolvedPath, 'utf-8')) as Record<
      string,
      unknown
    >;

    return initializeApp({
      credential: cert(serviceAccountJson as Parameters<typeof cert>[0]),
      projectId,
    });
  },
};
