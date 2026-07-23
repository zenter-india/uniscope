import { registerAs } from '@nestjs/config';

export interface FirebaseConfig {
  projectId: string;
  serviceAccountKeyPath: string;
  serviceAccountKeyBase64: string | undefined;
}

export const firebaseConfig = registerAs(
  'firebase',
  (): FirebaseConfig => ({
    projectId: process.env['FIREBASE_PROJECT_ID'] ?? '',
    serviceAccountKeyPath:
      process.env['FIREBASE_SERVICE_ACCOUNT_KEY_PATH'] ?? './firebase-service-account.json',
    // Alternative to a mounted file — for hosts without a "secret files"
    // feature (e.g. Railway), base64-encode the JSON key and set it as a
    // regular env var instead.
    serviceAccountKeyBase64: process.env['FIREBASE_SERVICE_ACCOUNT_KEY_BASE64'],
  }),
);
