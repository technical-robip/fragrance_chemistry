import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { FORMULA_QUEUE } from './jobs.constants';

@Processor(FORMULA_QUEUE)
export class JobsProcessor extends WorkerHost {
  async process(job: Job<{ formulaId: string }>): Promise<{ ok: true; formulaId: string }> {
    // Placeholder: future IFRA/cost recompute, exports, etc.
    return { ok: true, formulaId: job.data.formulaId };
  }
}
