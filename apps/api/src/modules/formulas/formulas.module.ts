import { Module } from '@nestjs/common';
import { FormulasController } from './formulas.controller';
import { FormulaXlsxService } from './formula-xlsx.service';
import { FormulasService } from './formulas.service';

@Module({
  controllers: [FormulasController],
  providers: [FormulasService, FormulaXlsxService],
  exports: [FormulasService],
})
export class FormulasModule {}
