import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { FORMULA_QUEUE } from './jobs.constants';

@Injectable()
export class JobsService {
  constructor(@InjectQueue(FORMULA_QUEUE) private readonly queue: Queue) {}

  enqueueFormulaRecompute(formulaId: string) {
    return this.queue.add('recompute', { formulaId }, { removeOnComplete: 100 });
  }
}
