import * as fs from 'node:fs';
import * as path from 'node:path';
import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { FIREBASE_APP } from './firebase.constants.js';

/**
 * Factory provider that initialises the Firebase Admin SDK.
 * The service account JSON is loaded from the path defined in FIREBASE_SERVICE_ACCOUNT_KEY_PATH.
 * No FCM logic here — just app bootstrap for injection into feature modules.
 */
export const firebaseProvider: Provider = {
  provide: FIREBASE_APP,
  inject: [ConfigService],
  useFactory: (configService: ConfigService): App => {
    const existingApps = getApps();
    if (existingApps.length > 0) {
      return existingApps[0] as App;
    }

    const projectId = configService.getOrThrow<string>('firebase.projectId');
    const keyPath = configService.getOrThrow<string>('firebase.serviceAccountKeyPath');
    const resolvedPath = path.isAbsolute(keyPath) ? keyPath : path.resolve(process.cwd(), keyPath);

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
