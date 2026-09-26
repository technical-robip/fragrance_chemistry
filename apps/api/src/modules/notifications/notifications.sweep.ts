import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { NOTIFICATION_QUEUE } from './notifications.constants';
import { NotificationsService } from './notifications.service';

@Injectable()
export class NotificationSweepScheduler implements OnModuleInit {
  constructor(@InjectQueue(NOTIFICATION_QUEUE) private readonly queue: Queue) {}

  async onModuleInit() {
    await this.queue.upsertJobScheduler(
      'notification-sweep',
      { every: 5 * 60 * 1000 },
      { name: 'sweep', data: {} },
    );
  }
}

@Processor(NOTIFICATION_QUEUE)
export class NotificationSweepProcessor extends WorkerHost {
  constructor(private readonly notifications: NotificationsService) {
    super();
  }

  process(): Promise<{ users: number }> {
    return this.notifications.sweepActiveClocks();
  }
}
