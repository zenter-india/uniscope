import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service.js';

/**
 * Database size comes straight from the app's own Postgres connection
 * (`pg_database_size(current_database())`) — no separate credential
 * needed, since the backend is already connected via DATABASE_URL. This
 * is the number that actually gates the account: Supabase's own docs
 * confirm a Free Plan project goes **read-only** once database size
 * (not disk size) exceeds 500 MB — verified live against production:
 * 31,124,627 bytes (~29.7 MB) at time of writing, well under the limit.
 *
 * API request counts (optional second section) need a genuinely separate
 * credential — a Supabase **personal access token** (Management API
 * auth, generated at supabase.com/dashboard/account/tokens), NOT the
 * SUPABASE_SERVICE_ROLE_KEY/SUPABASE_ANON_KEY already used elsewhere in
 * this app for runtime DB/storage access. Confirmed via Supabase's own
 * OpenAPI spec (https://api.supabase.com/api/v1-json, fetched and
 * parsed live this session — Scalar's rendered docs pages don't resolve
 * through automated tools, but the raw spec does): real endpoint is
 * `GET /v1/projects/{ref}/analytics/endpoints/usage.api-requests-count`.
 * Silently skipped (not an error) if SUPABASE_ACCESS_TOKEN is unset.
 */

const FREE_PLAN_DB_SIZE_LIMIT_BYTES = 500 * 1024 * 1024;
const SUPABASE_MANAGEMENT_API_URL = 'https://api.supabase.com';
const CACHE_TTL_MS = 5 * 60 * 1000;

export interface SupabaseUsageSummary {
  configured: boolean;
  databaseSizeBytes?: number;
  databaseSizeLimitBytes?: number;
  apiRequestCount24h?: number;
  apiRequestCountConfigured: boolean;
  fetchedAt?: string;
  error?: string;
}

@Injectable()
export class SupabaseUsageService {
  private readonly logger = new Logger(SupabaseUsageService.name);
  private readonly accessToken = process.env.SUPABASE_ACCESS_TOKEN;
  private readonly projectRef = this.deriveProjectRef();

  private cached: { summary: SupabaseUsageSummary; expiresAt: number } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  private deriveProjectRef(): string | null {
    const url = process.env.SUPABASE_URL;
    if (!url) return null;
    const match = /https?:\/\/([a-z0-9]+)\.supabase\.co/.exec(url);
    return match?.[1] ?? null;
  }

  async getUsageSummary(): Promise<SupabaseUsageSummary> {
    if (this.cached && this.cached.expiresAt > Date.now()) {
      return this.cached.summary;
    }

    let databaseSizeBytes: number | undefined;
    try {
      const rows = await this.prisma.$queryRawUnsafe<{ bytes: bigint }[]>(
        'SELECT pg_database_size(current_database()) AS bytes',
      );
      databaseSizeBytes = Number(rows[0]?.bytes ?? 0);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`[supabase-usage] db size query failed: ${message}`);
      return { configured: false, apiRequestCountConfigured: false, error: message };
    }

    let apiRequestCount24h: number | undefined;
    const apiRequestCountConfigured = Boolean(this.accessToken && this.projectRef);
    if (apiRequestCountConfigured) {
      try {
        const res = await fetch(
          `${SUPABASE_MANAGEMENT_API_URL}/v1/projects/${this.projectRef}/analytics/endpoints/usage.api-requests-count`,
          { headers: { Authorization: `Bearer ${this.accessToken}` } },
        );
        const body = (await res.json()) as { result?: { count: number }[]; error?: unknown };
        if (res.ok && body.result) {
          apiRequestCount24h = body.result[0]?.count;
        } else {
          this.logger.warn(`[supabase-usage] api-requests-count failed: ${JSON.stringify(body.error)}`);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`[supabase-usage] api-requests-count request failed: ${message}`);
      }
    }

    const summary: SupabaseUsageSummary = {
      configured: true,
      databaseSizeBytes,
      databaseSizeLimitBytes: FREE_PLAN_DB_SIZE_LIMIT_BYTES,
      apiRequestCount24h,
      apiRequestCountConfigured,
      fetchedAt: new Date().toISOString(),
    };

    this.cached = { summary, expiresAt: Date.now() + CACHE_TTL_MS };
    return summary;
  }
}
