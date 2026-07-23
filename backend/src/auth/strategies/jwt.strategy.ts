import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { JwtConfig } from '../../config/index.js';
import { PrismaService } from '../../database/prisma/prisma.service.js';
import type { JwtPayload } from '../decorators/current-user.decorator.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const cfg = config.get<JwtConfig>('jwt')!;
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: cfg.accessSecret,
    });
  }

  /**
   * A DB lookup on every authenticated request trades a little latency for
   * instant ban/deactivation enforcement — without it, a banned user's
   * still-valid JWT would keep working until it naturally expires (up to
   * ACCESS_TTL later). One indexed findUnique is cheap enough to be worth
   * that guarantee.
   */
  async validate(payload: JwtPayload): Promise<JwtPayload> {
    if (!payload.sub) {
      throw new UnauthorizedException();
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { isBanned: true, isActive: true, deletedAt: true },
    });

    if (!user || user.isBanned || !user.isActive || user.deletedAt) {
      throw new UnauthorizedException('Account is no longer accessible');
    }

    return payload;
  }
}
