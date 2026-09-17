import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { DRIZZLE } from './database.tokens';

@Global()
@Module({
  providers: [DatabaseService, { provide: DRIZZLE, useExisting: DatabaseService }],
  exports: [DatabaseService, DRIZZLE],
})
export class DatabaseModule {}
