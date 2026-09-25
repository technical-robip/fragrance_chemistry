import { Module } from '@nestjs/common';
import { FormulasModule } from '../formulas/formulas.module';
import { CostingController } from './costing.controller';
import { CostingService } from './costing.service';

@Module({
  imports: [FormulasModule],
  controllers: [CostingController],
  providers: [CostingService],
  exports: [CostingService],
})
export class CostingModule {}
