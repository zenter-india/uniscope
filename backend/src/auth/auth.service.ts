import { Injectable } from '@nestjs/common';
import { UsersService } from '../modules/users/users.service.js';
import { OtpService } from './otp.service.js';
import { TokenService } from './token.service.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly otpService: OtpService,
    private readonly tokenService: TokenService,
    private readonly usersService: UsersService,
  ) {}

  async requestOtp(phone: string): Promise<{ requestId: string }> {
    return this.otpService.requestOtp(phone);
  }

  async verifyOtp(
    requestId: string,
    otp: string,
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
    const { phoneHash } = await this.otpService.verifyOtp(requestId, otp);
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
