import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import {
  createEvaluationBodySchema,
  CreateEvaluationBody,
  listEvaluationsQuerySchema,
  ListEvaluationsQuery,
  updateEvaluationBodySchema,
  UpdateEvaluationBody,
} from '@fc/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtPayload } from '../auth/auth.types';
import { RequiresFeature } from '../auth/roles.decorator';
import { EvaluationsService } from './evaluations.service';

@Controller('evaluations')
@RequiresFeature('evaluation')
export class EvaluationsController {
  constructor(private readonly evaluations: EvaluationsService) {}

  @Get()
  list(
    @Req() req: { user: JwtPayload },
    @Query(new ZodValidationPipe(listEvaluationsQuerySchema)) query: ListEvaluationsQuery,
  ) {
    return this.evaluations.list(req.user, query.formulaId);
  }

  @Post()
  create(
    @Req() req: { user: JwtPayload },
    @Body(new ZodValidationPipe(createEvaluationBodySchema)) body: CreateEvaluationBody,
  ) {
    return this.evaluations.create(req.user, body);
  }

  @Patch(':id')
  update(
    @Req() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateEvaluationBodySchema)) body: UpdateEvaluationBody,
  ) {
    return this.evaluations.update(req.user, id, body);
  }
}
