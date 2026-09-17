import { Body, Controller, Post } from '@nestjs/common';
import { JobsService } from './jobs.service';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Post('formulas/recompute')
  recompute(@Body() body: { formulaId: string }) {
    return this.jobs.enqueueFormulaRecompute(body.formulaId);
  }
}
