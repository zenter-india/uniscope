import { Injectable, Logger } from '@nestjs/common';

/**
 * Reads currently-active RTC channels straight from Agora's Channel
 * Management REST API (`GET /dev/v1/channel/{appid}`, Basic Auth with
 * Customer ID/Secret) — this is a DIFFERENT API family from Agora's
 * Analytics/Usage REST API, and deliberately the only one wired up here.
 *
 * The Analytics API (`GET /dev/v3/usage`, monthly minute totals against
 * the 10,000 free-minute/month allowance) was tried first and is NOT
 * usable from this backend: every combination of App ID / Customer ID as
 * `project_id`, across two independently-generated Customer ID/Secret
 * pairs, returned "Project not found" from Agora's own backend — most
 * likely because that specific API is gated behind a paid plan (this
 * account is confirmed on Agora's free plan via Console), though Agora
 * never said so explicitly. This Channel Management API, by contrast,
 * works cleanly on the same free-plan account with the same credentials
 * — confirmed live (`{"success":true,"data":{"channels":[],"total_size":0}}`)
 * — so it's what's actually wired up.
 *
 * What this DOES tell you: how many Agora calls are live on Uniscope
 * *right now*, and who's on them. What it does NOT tell you: cumulative
 * minutes used this month, or how much of the 10,000 free minutes is
 * left — that number is only visible in Agora Console's own Usage page
 * (Console → Usage) until/unless the Analytics API becomes reachable.
 *
 * Needs AGORA_APP_ID (already used for RTC token generation elsewhere)
 * plus AGORA_CUSTOMER_ID/AGORA_CUSTOMER_SECRET (generated separately via
 * Agora Console → Developer Toolkit → RESTful API → "Add a secret" — NOT
 * the same credential as AGORA_APP_CERTIFICATE). Silently inert
 * (`configured: false`) if any is missing.
 *
 * Cached for a much shorter window than Railway's usage numbers (15s, not
 * 5min) — this is meant to read as "live," and a plain GET against a
 * small account's channel list is cheap enough that a short cache is
 * just insurance against a burst of rapid page refreshes, not a real
 * rate-limit concern.
 */

const AGORA_API_URL = 'https://api.agora.io';
const CACHE_TTL_MS = 15 * 1000;

interface AgoraChannel {
  channelName: string;
  userCount: number;
}

export interface AgoraUsageSummary {
  configured: boolean;
  activeChannelCount?: number;
  channels?: AgoraChannel[];
  fetchedAt?: string;
  error?: string;
}

@Injectable()
export class AgoraUsageService {
  private readonly logger = new Logger(AgoraUsageService.name);
  private readonly appId = process.env.AGORA_APP_ID;
  private readonly customerId = process.env.AGORA_CUSTOMER_ID;
  private readonly customerSecret = process.env.AGORA_CUSTOMER_SECRET;

  private cached: { summary: AgoraUsageSummary; expiresAt: number } | null = null;

  async getUsageSummary(): Promise<AgoraUsageSummary> {
    if (!this.appId || !this.customerId || !this.customerSecret) {
      return { configured: false, error: 'Agora integration not configured' };
    }

    if (this.cached && this.cached.expiresAt > Date.now()) {
      return this.cached.summary;
    }

    try {
      const auth = Buffer.from(`${this.customerId}:${this.customerSecret}`).toString('base64');
      const res = await fetch(`${AGORA_API_URL}/dev/v1/channel/${this.appId}`, {
        headers: { Authorization: `Basic ${auth}` },
      });

      const body = (await res.json()) as {
        success?: boolean;
        data?: { channels: { channel_name: string; user_count: number }[]; total_size: number };
        message?: string;
      };

      if (!res.ok || !body.success || !body.data) {
        const message = body.message ?? `Agora API returned ${res.status}`;
        this.logger.warn(`[agora-usage] query failed: ${message}`);
        return { configured: true, error: message };
      }

      const summary: AgoraUsageSummary = {
        configured: true,
        activeChannelCount: body.data.total_size,
        channels: body.data.channels.map((c) => ({
          channelName: c.channel_name,
          userCount: c.user_count,
        })),
        fetchedAt: new Date().toISOString(),
      };

      this.cached = { summary, expiresAt: Date.now() + CACHE_TTL_MS };
      return summary;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`[agora-usage] request failed: ${message}`);
      return { configured: true, error: message };
    }
  }
}
