import { config } from 'dotenv';
import path from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getEnv } from './config/env';

config({ path: path.resolve(process.cwd(), '../../.env') });

async function bootstrap() {
  const env = getEnv();
  const app = await NestFactory.create(AppModule);
  const origins = env.API_CORS_ORIGIN.split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: origins.length === 1 ? origins[0] : origins,
    credentials: true,
  });
  app.setGlobalPrefix('api/v1');
  await app.listen(env.API_PORT);
}

bootstrap();
