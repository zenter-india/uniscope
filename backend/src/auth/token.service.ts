import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import { createHash } from 'crypto';
import type { JwtConfig } from '../config/index.js';
import { PrismaService } from '../database/prisma/prisma.service.js';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface RefreshPayload {
  sub: string;
  role: UserRole;
  type: 'refresh';
}

@Injectable()
export class TokenService {
  private readonly cfg: JwtConfig;

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.cfg = this.config.get<JwtConfig>('jwt')!;
  }

  private sha256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  async issueTokenPair(userId: string, role: UserRole): Promise<TokenPair> {
    const accessToken = this.jwtService.sign(
      { sub: userId, role },
      { secret: this.cfg.accessSecret, expiresIn: this.cfg.accessTtl },
    );

    const refreshToken = this.jwtService.sign(
      { sub: userId, role, type: 'refresh' },
      { secret: this.cfg.refreshSecret, expiresIn: this.cfg.refreshTtl },
    );

    const refreshTokenHash = this.sha256(refreshToken);

    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash },
    });

    return { accessToken, refreshToken };
  }

  async rotateRefreshToken(
    refreshToken: string,
  ): Promise<TokenPair & { userId: string; role: UserRole }> {
    let payload: RefreshPayload;

    try {
      payload = this.jwtService.verify<RefreshPayload>(refreshToken, {
        secret: this.cfg.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, refreshTokenHash: true },
    });

    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException('Session expired');
    }

    const incomingHash = this.sha256(refreshToken);
    if (incomingHash !== user.refreshTokenHash) {
      throw new UnauthorizedException('Token reuse detected');
    }

    const tokens = await this.issueTokenPair(user.id, user.role);
    return { ...tokens, userId: user.id, role: user.role };
  }

  async clearRefreshToken(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });
  }
}
