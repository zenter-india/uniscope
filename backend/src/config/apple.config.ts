import { registerAs } from '@nestjs/config';

export interface AppleConfig {
  bundleId: string;
  issuerId: string;
  keyId: string;
  /** .p8 private key contents (PEM), with literal `\n` escapes in the env
   * var unescaped back into real newlines — same handling this repo already
   * gives other multi-line PEM-shaped secrets. */
  privateKey: string;
  /** 'xcode' | 'sandbox' | 'production' — maps to the app-store-server-library
   * Environment enum in WalletService. 'xcode' is for local StoreKit Testing
   * configuration files (fully offline, Apple-testing-root-signed). */
  environment: string;
  /** Numeric App Store app id — required by SignedDataVerifier outside the
   * sandbox environment, omitted (left blank) for sandbox/xcode. */
  appAppleId: string;
}

export const appleConfig = registerAs(
  'apple',
  (): AppleConfig => ({
    bundleId: process.env['APPLE_BUNDLE_ID'] ?? '',
    issuerId: process.env['APPLE_ISSUER_ID'] ?? '',
    keyId: process.env['APPLE_KEY_ID'] ?? '',
    privateKey: (process.env['APPLE_PRIVATE_KEY'] ?? '').replace(/\\n/g, '\n'),
    environment: process.env['APPLE_ENVIRONMENT'] ?? 'production',
    appAppleId: process.env['APPLE_APP_APPLE_ID'] ?? '',
  }),
);
