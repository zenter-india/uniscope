export interface OtpProvider {
  /**
   * Send OTP to the given phone number.
   * Returns a serviceId/requestId to be used for verification.
   */
  sendOtp(phone: string): Promise<{ serviceId: string }>;

  /**
   * Verify the OTP entered by the user.
   * Returns true if valid, throws UnauthorizedException if invalid/expired.
   */
  verifyOtp(phone: string, code: string, serviceId: string): Promise<boolean>;
}

export const OTP_PROVIDER = 'OTP_PROVIDER';
