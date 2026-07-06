import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import {
  ORDER_OFFER_QUEUE,
  OFFER_EXPIRY_JOB,
  OFFER_EXPIRY_MS,
  type OfferExpiryJobData,
} from './order-offer.queue.constants';

@Injectable()
export class OrderOfferQueueProducer {
  constructor(@InjectQueue(ORDER_OFFER_QUEUE) private readonly queue: Queue) {}

  async enqueueOfferExpiry(data: OfferExpiryJobData): Promise<void> {
    await this.queue.add(OFFER_EXPIRY_JOB, data, {
      delay: OFFER_EXPIRY_MS,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5_000 },
      // jobId is deterministic per (order, rider) so if rider is reassigned,
      // the old expiry job remains but the processor no-ops on riderId mismatch.
      jobId: `offer_expiry_${data.orderId}_${data.riderId}`,
    });
  }
}
