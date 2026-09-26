import { Injectable } from '@nestjs/common';
import type { DeliveryResult, NotificationChannel, NotificationDeliveryMessage } from './channel';

export type ResendEmailConfig = {
  enabled: boolean;
  apiKey?: string;
};

/**
 * Resend is wired as a port only. A present key does not place an HTTP call.
 * Replace `skipped` / `sender_not_implemented` with the Resend request when sending is ready.
 */
@Injectable()
export class ResendEmailChannel implements NotificationChannel {
  readonly id = 'email' as const;

  constructor(private readonly config: ResendEmailConfig) {}

  deliver(_message: NotificationDeliveryMessage): Promise<DeliveryResult> {
    if (!this.config.enabled || !this.config.apiKey) {
      return Promise.resolve({ status: 'skipped', reason: 'not_configured' });
    }
    return Promise.resolve({ status: 'skipped', reason: 'sender_not_implemented' });
  }
}
