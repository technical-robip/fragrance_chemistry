import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { createFormulaBodySchema, CreateFormulaBody } from '@fc/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtPayload } from '../auth/auth.types';
import { FormulasService } from './formulas.service';

@Controller('formulas')
export class FormulasController {
  constructor(private readonly formulas: FormulasService) {}

  @Get()
  list(@Req() req: { user: JwtPayload }) {
    return this.formulas.list(req.user);
  }

  @Get(':id')
  get(@Req() req: { user: JwtPayload }, @Param('id') id: string) {
    return this.formulas.get(req.user, id);
  }

  @Post()
  create(
    @Req() req: { user: JwtPayload },
    @Body(new ZodValidationPipe(createFormulaBodySchema)) body: CreateFormulaBody,
  ) {
    return this.formulas.create(req.user, body);
  }
}
