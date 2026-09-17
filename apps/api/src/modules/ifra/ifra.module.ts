import { Module } from '@nestjs/common';
import { IfraController } from './ifra.controller';
import { IfraService } from './ifra.service';

@Module({
  controllers: [IfraController],
  providers: [IfraService],
})
export class IfraModule {}
