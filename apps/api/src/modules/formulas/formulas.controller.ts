import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Req,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  createFormulaBodySchema,
  CreateFormulaBody,
  exportFormulasBodySchema,
  ExportFormulasBody,
  replaceFormulaLinesBodySchema,
  ReplaceFormulaLinesBody,
  updateFormulaBodySchema,
  UpdateFormulaBody,
} from '@fc/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtPayload } from '../auth/auth.types';
import { RequiresFeature } from '../auth/roles.decorator';
import { FormulaXlsxService } from './formula-xlsx.service';
import { FormulasService } from './formulas.service';

@Controller('formulas')
export class FormulasController {
  constructor(
    private readonly formulas: FormulasService,
    private readonly xlsx: FormulaXlsxService,
  ) {}

  @Get()
  list(@Req() req: { user: JwtPayload }) {
    return this.formulas.list(req.user);
  }

  @Get(':idOrSlug')
  get(@Req() req: { user: JwtPayload }, @Param('idOrSlug') idOrSlug: string) {
    return this.formulas.get(req.user, idOrSlug);
  }

  @Post('export')
  @HttpCode(200)
  @RequiresFeature('workbench')
  async export(
    @Req() req: { user: JwtPayload },
    @Res({ passthrough: true }) res: Response,
    @Body(new ZodValidationPipe(exportFormulasBodySchema)) body: ExportFormulasBody,
  ) {
    const file = await this.xlsx.exportWorkbook(req.user, body);
    const ascii = file.filename.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '');
    res.setHeader('Content-Type', file.mime);
    res.setHeader('Content-Disposition', `attachment; filename="${ascii}"`);
    return new StreamableFile(file.buffer);
  }

  @Post()
  @RequiresFeature('workbench')
  create(
    @Req() req: { user: JwtPayload },
    @Body(new ZodValidationPipe(createFormulaBodySchema)) body: CreateFormulaBody,
  ) {
    return this.formulas.create(req.user, body);
  }

  @Patch(':idOrSlug')
  @RequiresFeature('workbench')
  update(
    @Req() req: { user: JwtPayload },
    @Param('idOrSlug') idOrSlug: string,
    @Body(new ZodValidationPipe(updateFormulaBodySchema)) body: UpdateFormulaBody,
  ) {
    return this.formulas.update(req.user, idOrSlug, body);
  }

  @Put(':idOrSlug/lines')
  @RequiresFeature('workbench')
  replaceLines(
    @Req() req: { user: JwtPayload },
    @Param('idOrSlug') idOrSlug: string,
    @Body(new ZodValidationPipe(replaceFormulaLinesBodySchema)) body: ReplaceFormulaLinesBody,
  ) {
    return this.formulas.replaceLines(req.user, idOrSlug, body);
  }

  @Delete(':idOrSlug')
  @RequiresFeature('workbench')
  remove(@Req() req: { user: JwtPayload }, @Param('idOrSlug') idOrSlug: string) {
    return this.formulas.remove(req.user, idOrSlug);
  }
}
