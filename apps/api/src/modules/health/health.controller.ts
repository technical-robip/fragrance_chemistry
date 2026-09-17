import { Controller, Get } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { Public } from '../auth/public.decorator';
import { DatabaseService } from '../../database/database.service';
import { RedisService } from '../../redis/redis.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService,
  ) {}

  @Public()
  @Get()
  async check() {
    let database: 'ok' | 'error' = 'ok';
    let redis: 'ok' | 'error' = 'ok';
    try {
      await this.db.db.execute(sql`select 1`);
    } catch {
      database = 'error';
    }
    try {
      const key = `health:api`;
      await this.redis.client.set(key, '1', 'EX', 30);
      const val = await this.redis.client.get(key);
      if (val !== '1') redis = 'error';
    } catch {
      redis = 'error';
    }
    const status = database === 'ok' && redis === 'ok' ? 'ok' : 'degraded';
    return { status, service: '@fc/api', checks: { database, redis } };
  }
}
