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
 * NOT YET LIVE-VERIFIED — unlike every other provider/module in this
 * project (see CLAUDE.md "Conventions to follow": every new module gets
 * tested against the real running backend before being considered done).
 * This was built from MSG91's documented API shape but has never been
 * exercised against a real MSG91 account, because no MSG91_AUTH_KEY/
 * MSG91_TEMPLATE_ID exist yet — the client needs to (1) create an MSG91
 * account, (2) complete India's mandatory DLT registration for an OTP
 * sender + template (SMS regulation, not an MSG91-specific hoop — every
 * India SMS provider requires this), and (3) hand over the resulting
 * auth key + template id before this can be flipped on for real, the same
 * way TwilioOtpProvider needed real Twilio creds before OTP_PROVIDER_TYPE
 * could move off mock.
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
    const url = `https://control.msg91.com/api/v5/otp?template_id=${this.templateId}&mobile=${mobile}`;

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
