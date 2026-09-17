import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import pg from 'pg';
import { getEnv } from '../config/env';
import * as schema from './schema';
import { DB_TX } from './database.tokens';

export type AppDatabase = NodePgDatabase<typeof schema>;

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: pg.Pool;
  readonly db: AppDatabase;

  constructor(@Inject(ClsService) private readonly cls: ClsService) {
    const env = getEnv();
    this.pool = new pg.Pool({ connectionString: env.DATABASE_URL });
    this.db = drizzle(this.pool, { schema });
  }

  /** Drizzle instance bound to the current request transaction when present. */
  client(): AppDatabase {
    const tx = this.cls.get<AppDatabase | undefined>(DB_TX);
    return tx ?? this.db;
  }

  async runWithTenant<T>(userId: string | undefined, fn: () => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => {
      if (userId) {
        await tx.execute(sql`SELECT set_config('app.user_id', ${userId}, true)`);
      }
      this.cls.set(DB_TX, tx);
      try {
        return await fn();
      } finally {
        this.cls.set(DB_TX, undefined);
      }
    });
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
