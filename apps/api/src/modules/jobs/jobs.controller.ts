import { Body, Controller, Post, Req } from '@nestjs/common';
import { JwtPayload } from '../auth/auth.types';
import { RequiresFeature } from '../auth/roles.decorator';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { JobsService } from './jobs.service';

@Controller('jobs')
export class JobsController {
  constructor(
    private readonly jobs: JobsService,
    private readonly entitlements: EntitlementsService,
  ) {}

  @Post('formulas/recompute')
  recompute(@Body() body: { formulaId: string }) {
    return this.jobs.enqueueFormulaRecompute(body.formulaId);
  }

  @Post('pdf-export')
  @RequiresFeature('pdf_export')
  async pdfExport(@Req() req: { user: JwtPayload }) {
    await this.entitlements.incrementPdfExport(req.user.sub);
    return { ok: true };
  }
}
