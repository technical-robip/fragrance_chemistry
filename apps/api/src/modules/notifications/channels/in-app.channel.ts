import { Injectable } from '@nestjs/common';
import type { DeliveryResult, NotificationChannel, NotificationDeliveryMessage } from './channel';

/** The inbox row written by the sync is the in-app delivery. */
@Injectable()
export class InAppChannel implements NotificationChannel {
  readonly id = 'in_app' as const;

  deliver(_message: NotificationDeliveryMessage): Promise<DeliveryResult> {
    return Promise.resolve({ status: 'delivered' });
  }
}
