import { registerAs } from '@nestjs/config';

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  verifyServiceSid: string;
  channel: 'sms' | 'whatsapp';
}

export const twilioConfig = registerAs(
  'twilio',
  (): TwilioConfig => ({
    accountSid: process.env['TWILIO_ACCOUNT_SID'] ?? '',
    authToken: process.env['TWILIO_AUTH_TOKEN'] ?? '',
    verifyServiceSid: process.env['TWILIO_VERIFY_SERVICE_SID'] ?? '',
    channel: process.env['OTP_CHANNEL'] === 'whatsapp' ? 'whatsapp' : 'sms',
  }),
);
