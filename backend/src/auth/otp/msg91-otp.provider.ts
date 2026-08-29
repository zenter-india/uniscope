import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Msg91Config } from '../../config/index.js';
import type { OtpProvider } from './otp-provider.interface.js';

/** MSG91 response shape for both the send and verify OTP endpoints — see
 * https://docs.msg91.com/otp (and cross-checked against MSG91's own PHP
 * SDK, github.com/craftsys/msg91-php, since the hosted docs are JS-rendered
 * and not fetchable here). `type` is "success" or "error"; `message` is a
 * request id on a successful send, or a human-readable reason on error
 * (mirrors `msg_type`/`msg` on some older MSG91 endpoints, not used here). */
interface Msg91Response {
  type: 'success' | 'error';
  message?: string;
}

/**
 * MSG91 OTP — India-focused SMS OTP provider, cheaper per-message than
 * Twilio for Indian numbers (see CLAUDE.md "OTP integration" for why this
 * exists alongside TwilioOtpProvider rather than replacing it: OTP_PROVIDER_TYPE
 * picks whichever is configured, so switching back is a one-line env change
 * if MSG91 ever needs to be swapped out).
 *
 * Live-verified against a real MSG91 account and a real DLT-approved OTP
 * template: two real phone numbers, two real SMS round trips through
 * POST /auth/otp/request -> POST /auth/otp/verify, both issuing real JWTs.
 * `otp_length=6` below matches what the app already expects everywhere
 * else (Twilio's fixed 6-digit codes, MockOtpProvider's fixed '111111')
 * — one live test came back 4 digits regardless of that param, inconclusive
 * whether that was a stale code from before this param was added or a real
 * template-level override, so VerifyOtpDto.code was also widened to a 4-8
 * range as a safety net either way.
 */
@Injectable()
export class Msg91OtpProvider implements OtpProvider {
  private readonly authKey: string;
  private readonly templateId: string;

  constructor(private readonly config: ConfigService) {
    const cfg = this.config.get<Msg91Config>('msg91')!;
    this.authKey = cfg.authKey;
    this.templateId = cfg.templateId;
  }

  /** MSG91's `mobile` param wants country code with no '+' and no spaces,
   * e.g. "919876543210" — our phone numbers arrive as E.164 ("+919876543210")
   * or already bare, so this just strips whatever isn't a digit. */
  private normaliseMobile(phone: string): string {
    return phone.replace(/\D/g, '');
  }

  async sendOtp(phone: string): Promise<{ serviceId: string }> {
    const mobile = this.normaliseMobile(phone);
    // otp_length=6 explicitly — MSG91's own default is 4 digits, which
    // doesn't match VerifyOtpDto's `code` validator (min 6, sized for
    // Twilio's 6-digit codes and MockOtpProvider's fixed 6-digit
    // '111111'). Found this live: a real 4-digit MSG91 code got rejected
    // by our own validation before ever reaching MSG91's verify call.
    // Matching MSG91's length to what the rest of the app already expects
    // is simpler and safer than loosening validation app-wide.
    const url = `https://control.msg91.com/api/v5/otp?template_id=${this.templateId}&mobile=${mobile}&otp_length=6`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        authkey: this.authKey,
        'Content-Type': 'application/json',
      },
    });

    const data = (await response.json().catch(() => null)) as Msg91Response | null;

    if (!response.ok || !data || data.type !== 'success') {
      console.error('[MSG91] sendOtp failed:', response.status, data);
      throw new ServiceUnavailableException('OTP service temporarily unavailable');
    }

    // Unlike Twilio (a Verify Service SID) MSG91 has no separate per-request
    // service identifier — it tracks the pending OTP by mobile number on its
    // own side. templateId is a stable, non-secret value that's safe to
    // round-trip through the client as "serviceId" the same way Twilio's
    // provider reuses its (also non-per-request) verifyServiceSid.
    return { serviceId: this.templateId };
  }

  async verifyOtp(phone: string, code: string, _serviceId: string): Promise<boolean> {
    const mobile = this.normaliseMobile(phone);
    const url = `https://control.msg91.com/api/v5/otp/verify?mobile=${mobile}&otp=${code}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { authkey: this.authKey },
    });

    const data = (await response.json().catch(() => null)) as Msg91Response | null;

    if (!data || data.type !== 'success') {
      // MSG91 returns type:"error" (still HTTP 200) for both "wrong code"
      // and "expired/no pending OTP" — it doesn't distinguish the way
      // Twilio's 404-vs-other-error split does, so both collapse to the
      // same user-facing message.
      throw new UnauthorizedException('OTP expired or invalid');
    }

    if (!response.ok) {
      console.error('[MSG91] verifyOtp failed:', response.status, data);
      throw new ServiceUnavailableException('OTP service temporarily unavailable');
    }

    return true;
  }
}
