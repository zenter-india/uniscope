import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { TwilioConfig } from '../../config/index.js';
import type { OtpProvider } from './otp-provider.interface.js';

@Injectable()
export class TwilioOtpProvider implements OtpProvider {
  private readonly accountSid: string;
  private readonly authToken: string;
  private readonly verifyServiceSid: string;

  constructor(private readonly config: ConfigService) {
    const cfg = this.config.get<TwilioConfig>('twilio')!;
    this.accountSid = cfg.accountSid;
    this.authToken = cfg.authToken;
    this.verifyServiceSid = cfg.verifyServiceSid;
  }

  private get basicAuth(): string {
    return Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');
  }

  async sendOtp(phone: string): Promise<{ serviceId: string }> {
    const url = `https://verify.twilio.com/v2/Services/${this.verifyServiceSid}/Verifications`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${this.basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: phone, Channel: 'sms' }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error('[Twilio] sendOtp failed:', response.status, body);
      throw new ServiceUnavailableException('OTP service temporarily unavailable');
    }

    // Twilio serviceId for verification is the Verify Service SID itself;
    // the per-verification lookup key is the phone number.
    return { serviceId: this.verifyServiceSid };
  }

  async verifyOtp(phone: string, code: string, serviceId: string): Promise<boolean> {
    const url = `https://verify.twilio.com/v2/Services/${serviceId}/VerificationChecks`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${this.basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: phone, Code: code }),
    });

    if (response.status === 404) {
      // Twilio returns 404 when the verification has already been consumed or expired
      throw new UnauthorizedException('OTP expired or invalid');
    }

    if (!response.ok) {
      const body = await response.text();
      console.error('[Twilio] verifyOtp failed:', response.status, body);
      throw new ServiceUnavailableException('OTP service temporarily unavailable');
    }

    const data = (await response.json()) as { status: string };

    if (data.status !== 'approved') {
      throw new UnauthorizedException('OTP expired or invalid');
    }

    return true;
  }
}
