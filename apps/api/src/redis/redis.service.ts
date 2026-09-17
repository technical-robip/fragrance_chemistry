import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { getEnv } from '../config/env';

@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: Redis;

  constructor() {
    const env = getEnv();
    this.client = new Redis({
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      db: env.REDIS_DB,
      username: env.REDIS_USERNAME,
      password: env.REDIS_PASSWORD,
      keyPrefix: env.REDIS_KEY_PREFIX,
      maxRetriesPerRequest: null,
    });
  }

  refreshKey(userId: string, jti: string) {
    return `auth:refresh:${userId}:${jti}`;
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}
