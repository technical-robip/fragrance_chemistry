import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import { costingEstimateQuerySchema, CostingEstimateQuery } from '@fc/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtPayload } from '../auth/auth.types';
import { RequiresFeature } from '../auth/roles.decorator';
import { CostingService } from './costing.service';

@Controller('costing')
@RequiresFeature('costing')
export class CostingController {
  constructor(private readonly costing: CostingService) {}

  @Get('formulas/:id')
  estimate(
    @Req() req: { user: JwtPayload },
    @Param('id') id: string,
    @Query(new ZodValidationPipe(costingEstimateQuerySchema)) query: CostingEstimateQuery,
  ) {
    return this.costing.estimateFormulaCost(req.user, id, query);
  }
}
