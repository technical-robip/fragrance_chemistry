import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { getEnv } from '../../config/env';
import { FORMULA_QUEUE } from './jobs.constants';
import { JobsController } from './jobs.controller';
import { JobsProcessor } from './jobs.processor';
import { JobsService } from './jobs.service';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: getEnv().REDIS_HOST,
        port: getEnv().REDIS_PORT,
        db: getEnv().REDIS_DB,
        username: getEnv().REDIS_USERNAME,
        password: getEnv().REDIS_PASSWORD,
      },
      prefix: getEnv().REDIS_KEY_PREFIX,
    }),
    BullModule.registerQueue({ name: FORMULA_QUEUE }),
  ],
  controllers: [JobsController],
  providers: [JobsService, JobsProcessor],
})
export class JobsModule {}
