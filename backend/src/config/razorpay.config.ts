import { registerAs } from '@nestjs/config';

export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
}

export const razorpayConfig = registerAs(
  'razorpay',
  (): RazorpayConfig => ({
    keyId: process.env['RAZORPAY_KEY_ID'] ?? '',
    keySecret: process.env['RAZORPAY_KEY_SECRET'] ?? '',
    webhookSecret: process.env['RAZORPAY_WEBHOOK_SECRET'] ?? '',
  }),
);
