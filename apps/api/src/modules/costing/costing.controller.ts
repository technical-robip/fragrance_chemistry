import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import { JwtPayload } from '../auth/auth.types';
import { CostingService } from './costing.service';

@Controller('costing')
export class CostingController {
  constructor(private readonly costing: CostingService) {}

  @Get('formulas/:id')
  estimate(
    @Req() req: { user: JwtPayload },
    @Param('id') id: string,
    @Query('batchGrams') batchGrams?: string,
  ) {
    const grams = batchGrams ? Number(batchGrams) : 100;
    return this.costing.estimateFormulaCost(req.user, id, grams);
  }
}
