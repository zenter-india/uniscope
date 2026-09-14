import { registerAs } from '@nestjs/config';

export interface JwtConfig {
  accessSecret: string;
  refreshSecret: string;
  /** Access token TTL in seconds (default: 900 = 15 min) — irrelevant to how
   * long a user stays logged in; dio_client.dart refreshes this silently on
   * a 401, invisibly to the user, as long as the refresh token below is
   * still good. */
  accessTtl: number;
  /** Refresh token TTL in seconds (default: 315360000 = ~10 years). This is
   * a rotating, single-use refresh token (TokenService.issueTokenPair
   * overwrites User.refreshTokenHash on every successful refresh) — so in
   * practice a user who opens the app at all within this window gets a
   * brand-new ~10-year token every time, and the effective session length
   * is "forever, until they open the app less often than once a decade."
   * This is the deliberate "stay logged in unless you actually log out"
   * behavior (2026-09-14) — was 604800 (7 days), which meant a user who
   * genuinely didn't open the app for over a week got bounced back to the
   * login screen for no reason other than time passing. A lost/stolen
   * device is still covered independently: JwtStrategy.validate() checks
   * isBanned/isActive/deletedAt from the DB on every single request, so
   * banning or soft-deleting an account still ends its session immediately
   * regardless of how long this TTL is. */
  refreshTtl: number;
}

export const jwtConfig = registerAs(
  'jwt',
  (): JwtConfig => ({
    accessSecret: process.env['JWT_ACCESS_SECRET'] ?? 'change-me-access-secret',
    refreshSecret:
      process.env['JWT_REFRESH_SECRET'] ?? 'change-me-refresh-secret',
    accessTtl: parseInt(process.env['JWT_ACCESS_TTL'] ?? '900', 10),
    refreshTtl: parseInt(process.env['JWT_REFRESH_TTL'] ?? '315360000', 10),
  }),
);
