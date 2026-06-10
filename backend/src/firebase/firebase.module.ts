import { Global, Module } from '@nestjs/common';
import { firebaseProvider } from './firebase.provider.js';
import { FIREBASE_APP } from './firebase.constants.js';

/**
 * Global Firebase module.
 * Provides the initialised firebase-admin App as FIREBASE_APP.
 * Marked @Global() so any module can inject the app without re-importing FirebaseModule.
 */
@Global()
@Module({
  providers: [firebaseProvider],
  exports: [FIREBASE_APP],
})
export class FirebaseModule {}
