import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from '../database/prisma/prisma.module.js';
import { UsersModule } from '../modules/users/users.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { RolesGuard } from './guards/roles.guard.js';
import { MockOtpProvider, OTP_PROVIDER, TwilioOtpProvider } from './otp/index.js';
import { OtpService } from './otp.service.js';
import { TokenService } from './token.service.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';

@Module({
  imports: [
    PassportModule,
    // JwtModule registered without default secret — TokenService signs with
    // per-call secrets from ConfigService, so we only need the module registered.
    JwtModule.register({}),
    PrismaModule,
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    OtpService,
    TokenService,
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
    TwilioOtpProvider,
    MockOtpProvider,
    {
      provide: OTP_PROVIDER,
      inject: [ConfigService, TwilioOtpProvider, MockOtpProvider],
      useFactory: (
        config: ConfigService,
        twilio: TwilioOtpProvider,
        mock: MockOtpProvider,
      ) => {
        const type = config.get<string>('OTP_PROVIDER_TYPE') ?? 'mock';
        return type === 'twilio' ? twilio : mock;
      },
    },
  ],
  exports: [JwtAuthGuard, RolesGuard, JwtStrategy],
})
export class AuthModule {}
