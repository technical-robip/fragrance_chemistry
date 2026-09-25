import { Module } from '@nestjs/common';
import { WeighingController } from './weighing.controller';
import { WeighingService } from './weighing.service';

@Module({
  controllers: [WeighingController],
  providers: [WeighingService],
})
export class WeighingModule {}
