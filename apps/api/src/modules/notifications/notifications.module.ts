import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { getEnv } from '../../config/env';
import { InAppChannel } from './channels/in-app.channel';
import { PushChannel } from './channels/push.channel';
import { ResendEmailChannel } from './channels/resend-email.channel';
import { NOTIFICATION_QUEUE } from './notifications.constants';
import { notificationControllerClasses } from './notifications.registry';
import { NotificationsService } from './notifications.service';
import { NotificationSweepProcessor, NotificationSweepScheduler } from './notifications.sweep';

@Module({
  imports: [BullModule.registerQueue({ name: NOTIFICATION_QUEUE })],
  controllers: notificationControllerClasses(getEnv().NODE_ENV),
  providers: [
    NotificationsService,
    InAppChannel,
    PushChannel,
    {
      provide: ResendEmailChannel,
      useFactory: () => {
        const env = getEnv();
        return new ResendEmailChannel({
          enabled: env.NOTIFICATIONS_EMAIL_ENABLED,
          apiKey: env.RESEND_API_KEY,
        });
      },
    },
    NotificationSweepScheduler,
    NotificationSweepProcessor,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
