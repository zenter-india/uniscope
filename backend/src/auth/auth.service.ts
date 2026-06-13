import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { UsersService } from '../modules/users/users.service.js';
import { MockOtpProvider } from './otp/mock-otp.provider.js';
import { OTP_PROVIDER } from './otp/otp-provider.interface.js';
import type { OtpProvider } from './otp/otp-provider.interface.js';
import { TokenService } from './token.service.js';

@Injectable()
export class AuthService {
  constructor(
    @Inject(OTP_PROVIDER) private readonly otpProvider: OtpProvider,
    private readonly tokenService: TokenService,
    private readonly usersService: UsersService,
  ) {}

  async requestOtp(phone: string): Promise<{ serviceId: string }> {
    return this.otpProvider.sendOtp(phone);
  }

  async verifyOtp(
    serviceId: string,
    phone: string,
    code: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    user: {
      id: string;
      role: string;
      displayName: string;
      isNewUser: boolean;
    };
  }> {
    await this.otpProvider.verifyOtp(phone, code, serviceId);

    // Derive phone hash to look up / create the user.
    // MockOtpProvider stores the hash; for Twilio we compute it here from the
    // verified phone number (Twilio handles the OTP truth — we just hash phone).
    let phoneHash: string;

    if (this.otpProvider instanceof MockOtpProvider) {
      phoneHash = this.otpProvider.sha256Public(
        this.otpProvider.normalisePhonePublic(phone),
      );
    } else {
      phoneHash = createHash('sha256')
        .update(phone.replace(/\s+/g, '').trim())
        .digest('hex');
    }

    const { user, isNewUser } =
      await this.usersService.findOrCreateByPhoneHash(phoneHash);

    const { accessToken, refreshToken } = await this.tokenService.issueTokenPair(
      user.id,
      user.role,
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        role: user.role,
        displayName: user.displayName,
        isNewUser,
      },
    };
  }

  async refreshToken(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const { accessToken, refreshToken: newRefreshToken } =
      await this.tokenService.rotateRefreshToken(refreshToken);
    return { accessToken, refreshToken: newRefreshToken };
  }

  async logout(userId: string): Promise<void> {
    await this.tokenService.clearRefreshToken(userId);
  }
}
