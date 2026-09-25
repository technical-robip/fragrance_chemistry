import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { getEnv } from '../config/env';

/** Default TTL for formula detail payloads (seconds). */
export const FORMULA_DETAIL_CACHE_TTL_SEC = 120;
export const DASHBOARD_BRIEFING_CACHE_TTL_SEC = 90;
export const IFRA_LIMITS_CACHE_TTL_SEC = 600;
export const CATALOG_PUBLIC_INDEX_TTL_SEC = 600;
export const CATALOG_PRIVATE_INDEX_TTL_SEC = 300;

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

  pdfExportCountKey(userId: string, yearMonth = new Date().toISOString().slice(0, 7)) {
    return `entitlements:pdf:${userId}:${yearMonth}`;
  }

  formulaDetailKey(ownerId: string, formulaId: string) {
    return `formula:detail:v2:${ownerId}:${formulaId}`;
  }

  dashboardBriefingKey(ownerId: string, formulaId: string) {
    return `dashboard:briefing:v2:${ownerId}:${formulaId}`;
  }

  ifraLimitsKey(categoryCode: string) {
    return `ifra:limits:${categoryCode}`;
  }

  catalogPublicIndexKey() {
    return 'catalog:index:public';
  }

  catalogPrivateIndexKey(userId: string) {
    return `catalog:index:private:${userId}`;
  }

  async cacheGet<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async cacheSet(key: string, value: unknown, ttlSec: number) {
    await this.client.set(key, JSON.stringify(value), 'EX', ttlSec);
  }

  async cacheDel(...keys: string[]) {
    const unique = [...new Set(keys.filter(Boolean))];
    if (unique.length === 0) return 0;
    return this.client.del(...unique);
  }

  async deleteRefreshTokensForUser(userId: string) {
    const pattern = `auth:refresh:${userId}:*`;
    let cursor = '0';
    do {
      const [next, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = next;
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } while (cursor !== '0');
  }

  async getPdfExportCount(userId: string) {
    const raw = await this.client.get(this.pdfExportCountKey(userId));
    const n = Number(raw ?? 0);
    return Number.isFinite(n) ? n : 0;
  }

  async incrementPdfExportCount(userId: string) {
    const key = this.pdfExportCountKey(userId);
    const next = await this.client.incr(key);
    if (next === 1) {
      await this.client.expire(key, 45 * 24 * 3600);
    }
    return next;
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}
