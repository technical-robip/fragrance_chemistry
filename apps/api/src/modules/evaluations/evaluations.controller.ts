import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { createEvaluationBodySchema, CreateEvaluationBody } from '@fc/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtPayload } from '../auth/auth.types';
import { EvaluationsService } from './evaluations.service';

@Controller('evaluations')
export class EvaluationsController {
  constructor(private readonly evaluations: EvaluationsService) {}

  @Get()
  list(@Req() req: { user: JwtPayload }) {
    return this.evaluations.list(req.user);
  }

  @Post()
  create(
    @Req() req: { user: JwtPayload },
    @Body(new ZodValidationPipe(createEvaluationBodySchema)) body: CreateEvaluationBody,
  ) {
    return this.evaluations.create(req.user, body);
  }
}
