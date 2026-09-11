import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { UsersService } from '../modules/users/users.service.js';
import {
  DEMO_ACCOUNT_OTP_CODE,
  isDemoAccountPhone,
  normalisePhone,
} from './demo-accounts.js';
import { MockOtpProvider } from './otp/mock-otp.provider.js';
import { OTP_PROVIDER } from './otp/otp-provider.interface.js';
import type { OtpProvider } from './otp/otp-provider.interface.js';
import { TokenService } from './token.service.js';

/** Returned as the `serviceId` for a demo-account OTP request — never
 * looked up anywhere, since verifyOtp's demo branch checks the fixed code
 * directly rather than validating a stored serviceId/code pair the way the
 * real providers do. */
const DEMO_SERVICE_ID = 'demo-account';

@Injectable()
export class AuthService {
  constructor(
    @Inject(OTP_PROVIDER) private readonly otpProvider: OtpProvider,
    private readonly tokenService: TokenService,
    private readonly usersService: UsersService,
  ) {}

  async requestOtp(phone: string): Promise<{ serviceId: string }> {
    if (isDemoAccountPhone(phone)) {
      // Skip the real provider entirely — it would try to actually SMS a
      // number that doesn't exist and fail. See demo-accounts.ts.
      return { serviceId: DEMO_SERVICE_ID };
    }
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
    const isDemo = isDemoAccountPhone(phone);

    if (isDemo) {
      if (code !== DEMO_ACCOUNT_OTP_CODE) {
        throw new UnauthorizedException('Invalid or expired code');
      }
    } else {
      await this.otpProvider.verifyOtp(phone, code, serviceId);
    }

    // Derive phone hash to look up / create the user.
    // MockOtpProvider stores the hash; for Twilio/MSG91 (and the demo-
    // account bypass above, which never touches a real provider) we
    // compute it here from the verified phone number the same way.
    let phoneHash: string;

    if (!isDemo && this.otpProvider instanceof MockOtpProvider) {
      phoneHash = this.otpProvider.sha256Public(
        this.otpProvider.normalisePhonePublic(phone),
      );
    } else {
      phoneHash = createHash('sha256').update(normalisePhone(phone)).digest('hex');
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
