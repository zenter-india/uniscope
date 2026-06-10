import { registerAs } from '@nestjs/config';

export interface FirebaseConfig {
  projectId: string;
  serviceAccountKeyPath: string;
}

export const firebaseConfig = registerAs(
  'firebase',
  (): FirebaseConfig => ({
    projectId: process.env['FIREBASE_PROJECT_ID'] ?? '',
    serviceAccountKeyPath:
      process.env['FIREBASE_SERVICE_ACCOUNT_KEY_PATH'] ?? './firebase-service-account.json',
  }),
);
