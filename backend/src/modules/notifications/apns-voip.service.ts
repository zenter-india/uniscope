import { Injectable, Logger } from '@nestjs/common';
import * as http2 from 'node:http2';
import jwt from 'jsonwebtoken';

/**
 * Sends real iOS VoIP pushes (PushKit) directly to APNs — this is a
 * completely separate delivery path from the FCM pushes NotificationsService
 * otherwise sends. FCM cannot deliver a VoIP push (the `apns-push-type: voip`
 * header + `<bundle-id>.voip` topic APNs requires for PushKit aren't
 * expressible through Firebase's API), so this talks to Apple's HTTP/2 APNs
 * endpoint directly, using token-based (ES256 .p8 key) authentication —
 * Apple's modern, recommended auth method: one key for the whole team, no
 * per-app certificate to renew every year (unlike the older, deprecated
 * per-app "VoIP Services Certificate").
 *
 * Why this exists at all: real ringing on iOS (a full-screen incoming-call
 * screen that works even with the app fully killed) requires CallKit, and
 * Apple only allows CallKit's `reportNewIncomingCall` to be triggered by a
 * genuine VoIP push — a regular alert/data push cannot do it. See the mobile
 * `AppDelegate.swift`'s PushKit wiring for the receiving side.
 *
 * Configuration is entirely optional — every method here is a silent no-op
 * (logged, never thrown) when the required env vars aren't set, matching the
 * same "best-effort, never block" contract FirebaseProvider/NotificationsService
 * already follow for FCM. Until a real Apple Developer VoIP-capable Auth Key
 * is provided, this class simply does nothing.
 */
@Injectable()
export class ApnsVoipService {
  private readonly logger = new Logger(ApnsVoipService.name);

  private readonly keyId = process.env.APNS_KEY_ID;
  private readonly teamId = process.env.APNS_TEAM_ID;
  private readonly bundleId = process.env.APNS_BUNDLE_ID ?? 'com.uniscope.uniscopeMobile';
  private readonly host =
    process.env.APNS_ENVIRONMENT === 'sandbox'
      ? 'https://api.sandbox.push.apple.com'
      : 'https://api.push.apple.com';
  private readonly privateKey: string | null;

  // Apple's token is valid up to 60 minutes and asks that a new one not be
  // generated more than once every ~20 minutes — cache and reuse it instead
  // of signing a fresh JWT per push.
  private cachedToken: { jwt: string; issuedAtMs: number } | null = null;
  private static readonly TOKEN_MAX_AGE_MS = 50 * 60 * 1000;

  constructor() {
    const base64Key = process.env.APNS_AUTH_KEY_BASE64;
    this.privateKey = base64Key
      ? Buffer.from(base64Key, 'base64').toString('utf8')
      : null;
    if (!this.isConfigured()) {
      this.logger.log(
        '[voip] APNs auth key not configured (APNS_AUTH_KEY_BASE64/APNS_KEY_ID/APNS_TEAM_ID) — VoIP pushes disabled',
      );
    }
  }

  private isConfigured(): boolean {
    return !!(this.privateKey && this.keyId && this.teamId);
  }

  private getAuthToken(): string {
    const now = Date.now();
    if (this.cachedToken && now - this.cachedToken.issuedAtMs < ApnsVoipService.TOKEN_MAX_AGE_MS) {
      return this.cachedToken.jwt;
    }
    const token = jwt.sign({ iss: this.teamId, iat: Math.floor(now / 1000) }, this.privateKey!, {
      algorithm: 'ES256',
      keyid: this.keyId,
    });
    this.cachedToken = { jwt: token, issuedAtMs: now };
    return token;
  }

  /**
   * Sends one VoIP push to a single device token. Payload is deliberately
   * minimal (just enough for the native PushKit handler to identify the
   * call) — Apple recommends keeping VoIP payloads small, and the actual
   * "ring" UI text is filled in natively on the device (see
   * `AppDelegate.swift`'s `pushRegistry(_:didReceiveIncomingPushWith:...)`),
   * not sent over the wire, mirroring Android's existing
   * `_ringForInstantCall` (also caller-name-free, generic copy only).
   *
   * Never throws — a failed VoIP push is logged and swallowed, same
   * best-effort contract as the FCM path. The caller (NotificationsService)
   * doesn't need to know or care whether this actually reached the device.
   */
  async sendIncomingCall(deviceToken: string, payload: { sessionId: string }): Promise<void> {
    if (!this.isConfigured()) return;

    const body = JSON.stringify(payload);
    const client = http2.connect(this.host);
    client.on('error', (err) => {
      this.logger.warn(`[voip] http2 client error: ${err}`);
    });

    try {
      await new Promise<void>((resolve, reject) => {
        const req = client.request({
          ':method': 'POST',
          ':path': `/3/device/${deviceToken}`,
          authorization: `bearer ${this.getAuthToken()}`,
          'apns-topic': `${this.bundleId}.voip`,
          'apns-push-type': 'voip',
          'apns-priority': '10',
          'apns-expiration': '0',
          'content-type': 'application/json',
        });

        let responseBody = '';
        let status: number | undefined;
        req.on('response', (headers) => {
          status = headers[':status'] as number;
        });
        req.on('data', (chunk) => {
          responseBody += chunk;
        });
        req.on('end', () => {
          if (status === 200) {
            this.logger.log(`[voip] push sent sessionId=${payload.sessionId}`);
          } else {
            // 410 = token no longer valid (uninstalled/reset) — the caller
            // could clean this up like the FCM stale-token path does, but
            // VoIP tokens are rare enough (one per iOS device that's ever
            // received a call request) that a log is enough for now.
            this.logger.warn(
              `[voip] push failed sessionId=${payload.sessionId} status=${status} body=${responseBody}`,
            );
          }
          resolve();
        });
        req.on('error', reject);
        req.end(body);
      });
    } catch (err) {
      this.logger.warn(`[voip] push failed sessionId=${payload.sessionId}: ${err}`);
    } finally {
      client.close();
    }
  }
}
