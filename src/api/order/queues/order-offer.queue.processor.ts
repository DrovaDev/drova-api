import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { EmailService } from 'src/services/email.service';
import { NotificationService } from 'src/api/notification/notification.service';
import { OrderDb } from '../order.db';
import {
  ORDER_OFFER_QUEUE,
  OFFER_EXPIRY_JOB,
  type OfferExpiryJobData,
} from './order-offer.queue.constants';

@Processor(ORDER_OFFER_QUEUE)
export class OrderOfferQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(OrderOfferQueueProcessor.name);

  constructor(
    private readonly orderDb: OrderDb,
    private readonly notificationService: NotificationService,
    private readonly emailService: EmailService,
  ) {
    super();
  }

  async process(job: Job<OfferExpiryJobData>) {
    if (job.name !== OFFER_EXPIRY_JOB) {
      this.logger.warn(`Unhandled job name: ${job.name}`);
      return;
    }

    const { orderId, riderId, businessAuthId, businessEmail, referenceCode } =
      job.data;

    const expired = await this.orderDb.expireOrderOffer({ orderId, riderId });

    if (!expired) {
      this.logger.log(
        `offer_expiry no-op for orderId=${orderId} riderId=${riderId} — already resolved`,
      );
      return;
    }

    this.logger.log(
      `Offer expired for orderId=${orderId} riderId=${riderId} — notifying business`,
    );

    const notifyPromises: Promise<void>[] = [
      this.notificationService.notifyBusinessOfferExpired(
        businessAuthId,
        orderId,
        referenceCode,
      ),
    ];

    if (businessEmail) {
      notifyPromises.push(
        this.emailService.sendMail({
          to: businessEmail,
          subject: 'Rider Did Not Respond — Order Needs Reassignment',
          text: `A rider did not accept order ${referenceCode} within 5 minutes.\n\nPlease log in to Drova and reassign the order to another rider.`,
        }),
      );
    }

    await Promise.allSettled(notifyPromises);
  }
}
