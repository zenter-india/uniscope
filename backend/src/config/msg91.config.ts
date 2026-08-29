import { registerAs } from '@nestjs/config';

export interface Msg91Config {
  authKey: string;
  templateId: string;
  /** Digits only, no '+' — MSG91's `mobile` param wants e.g. "919876543210",
   * not "+919876543210". OtpService/AuthService pass phone through in
   * whatever format the client sent; Msg91OtpProvider strips the '+' itself
   * (see normaliseMobile), so this isn't stored here. */
}

export const msg91Config = registerAs(
  'msg91',
  (): Msg91Config => ({
    authKey: process.env['MSG91_AUTH_KEY'] ?? '',
    templateId: process.env['MSG91_TEMPLATE_ID'] ?? '',
  }),
);
