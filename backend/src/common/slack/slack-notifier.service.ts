import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Posts to a Slack incoming webhook, if one is configured. A no-op (not an
 * error) when SLACK_WEBHOOK_URL is unset — ops alerts are a nice-to-have,
 * not something that should ever fail a request or block startup. Callers
 * (new-lead alerts, the daily digest, ...) never need to check whether
 * Slack is configured themselves.
 */
@Injectable()
export class SlackNotifierService {
  private readonly logger = new Logger(SlackNotifierService.name);

  constructor(private readonly config: ConfigService) {}

  async send(text: string): Promise<void> {
    const webhookUrl = this.config.get<string>('SLACK_WEBHOOK_URL');
    if (!webhookUrl) return;

    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        this.logger.warn(`Slack webhook returned ${res.status}: ${await res.text()}`);
      }
    } catch (err) {
      // A Slack outage/misconfiguration must never take down whatever
      // real work (e.g. saving a lead) triggered this notification.
      this.logger.warn(`Slack webhook request failed: ${err}`);
    }
  }
}
