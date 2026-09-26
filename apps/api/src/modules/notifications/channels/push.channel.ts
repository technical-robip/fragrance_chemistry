import { Injectable } from '@nestjs/common';
import type { DeliveryResult, NotificationChannel, NotificationDeliveryMessage } from './channel';

/** Native push (APNs / FCM) is a port. No device token store and no send. */
@Injectable()
export class PushChannel implements NotificationChannel {
  readonly id = 'push' as const;

  deliver(_message: NotificationDeliveryMessage): Promise<DeliveryResult> {
    return Promise.resolve({ status: 'skipped', reason: 'native_not_implemented' });
  }
}
