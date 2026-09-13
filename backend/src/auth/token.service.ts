import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
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
  private readonly logger = new Logger(TokenService.name);
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

  /** This endpoint previously had zero logging at all — a real "logged out
   * after 10-20 minutes, single device, single account" report (2026-09-13)
   * turned out to be undiagnosable after the fact because nothing here ever
   * left a trace, success or failure. Every branch now logs enough to
   * reconstruct what happened on the next occurrence: which user, and the
   * exact reason (expired/malformed JWT vs. no stored hash at all vs. a
   * genuine hash mismatch — three very different root causes that all
   * surfaced identically as "logged out" to the app before this). */
  async rotateRefreshToken(
    refreshToken: string,
  ): Promise<TokenPair & { userId: string; role: UserRole }> {
    let payload: RefreshPayload;

    try {
      payload = this.jwtService.verify<RefreshPayload>(refreshToken, {
        secret: this.cfg.refreshSecret,
      });
    } catch (err) {
      this.logger.warn(
        `[refresh] rejected: JWT verify failed (${(err as Error).name}: ${(err as Error).message})`,
      );
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.type !== 'refresh') {
      this.logger.warn(`[refresh] rejected: wrong token type for userId=${payload.sub}`);
      throw new UnauthorizedException('Invalid token type');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, refreshTokenHash: true },
    });

    if (!user || !user.refreshTokenHash) {
      this.logger.warn(
        `[refresh] rejected: no user or no stored hash for userId=${payload.sub}`,
      );
      throw new UnauthorizedException('Session expired');
    }

    const incomingHash = this.sha256(refreshToken);
    if (incomingHash !== user.refreshTokenHash) {
      this.logger.warn(`[refresh] rejected: token reuse detected for userId=${user.id}`);
      throw new UnauthorizedException('Token reuse detected');
    }

    const tokens = await this.issueTokenPair(user.id, user.role);
    this.logger.log(`[refresh] rotated ok for userId=${user.id}`);
    return { ...tokens, userId: user.id, role: user.role };
  }

  async clearRefreshToken(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });
  }
}
