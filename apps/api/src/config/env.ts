import { config as loadDotenv } from 'dotenv';
import path from 'node:path';
import { z } from 'zod';

loadDotenv({ path: path.resolve(process.cwd(), '../../.env') });

const trim = (v: unknown) => (typeof v === 'string' ? v.trim() : v);

const envSchema = z.object({
  NODE_ENV: z.preprocess(
    trim,
    z.enum(['development', 'test', 'production']).default('development'),
  ),
  API_PORT: z.preprocess(trim, z.coerce.number().int().min(1).max(65535).default(3000)),
  API_CORS_ORIGIN: z.preprocess(trim, z.string().min(1).default('http://localhost:5173')),
  DATABASE_URL: z.preprocess(trim, z.string().url()),
  DATABASE_URL_MIGRATOR: z.preprocess(trim, z.string().url()).optional(),
  REDIS_HOST: z.preprocess(trim, z.string().min(1)),
  REDIS_PORT: z.preprocess(trim, z.coerce.number().int().default(6380)),
  REDIS_DB: z.preprocess(trim, z.coerce.number().int().min(0).max(15).default(1)),
  REDIS_USERNAME: z.preprocess(trim, z.string().optional()),
  REDIS_PASSWORD: z.preprocess(trim, z.string().optional()),
  REDIS_KEY_PREFIX: z.preprocess(trim, z.string().default('fc:')),
  JWT_SECRET: z.preprocess(trim, z.string().min(16)),
  JWT_ACCESS_TTL: z.preprocess(trim, z.string().default('15m')),
  JWT_REFRESH_TTL: z.preprocess(trim, z.string().default('7d')),
});

export type AppEnv = z.infer<typeof envSchema>;

let cached: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (!cached) {
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      throw new Error(`Invalid environment: ${msg}`);
    }
    cached = parsed.data;
  }
  return cached;
}
