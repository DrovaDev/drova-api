import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { PAYOUTS_QUEUE, PROCESS_PAYOUT_JOB } from './payouts.queue.constants';

@Injectable()
export class PayoutsQueueProducer {
  constructor(@InjectQueue(PAYOUTS_QUEUE) private readonly queue: Queue) {}

  async enqueueProcessPayout(payoutId: string): Promise<void> {
    await this.queue.add(
      PROCESS_PAYOUT_JOB,
      { payoutId },
      {
        jobId: `payout:${payoutId}`,
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 10_000,
        },
      },
    );
  }
}
