import { Module } from '@nestjs/common';
import { CostingModule } from '../costing/costing.module';
import { EvaluationsModule } from '../evaluations/evaluations.module';
import { FormulasModule } from '../formulas/formulas.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [FormulasModule, CostingModule, EvaluationsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
