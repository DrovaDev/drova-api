import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import {
  PAYMENT_EMAIL_QUEUE,
  PAYMENT_SUCCESS_EMAIL_JOB,
  PAYMENT_FAILED_EMAIL_JOB,
  INVOICE_EMAIL_JOB,
  ORDER_STATUS_EMAIL_JOB,
  type PaymentSuccessEmailEnqueueData,
  type PaymentFailedEmailEnqueueData,
  type InvoiceEmailEnqueueData,
  type OrderStatusEmailEnqueueData,
} from './payment-email.queue.constants';

@Injectable()
export class PaymentEmailQueueProducer {
  constructor(
    @InjectQueue(PAYMENT_EMAIL_QUEUE) private readonly queue: Queue,
  ) {}

  async enqueuePaymentSuccessEmail(data: PaymentSuccessEmailEnqueueData) {
    const jobs: Array<Promise<unknown>> = [];
    const baseOpts = {
      attempts: 5,
      backoff: {
        type: 'exponential' as const,
        delay: 3_000,
      },
    };

    if (data.senderEmail) {
      jobs.push(
        this.queue.add(
          PAYMENT_SUCCESS_EMAIL_JOB,
          {
            kind: 'sender',
            to: data.senderEmail,
            name: data.senderName || 'Customer',
            referenceCode: data.referenceCode,
            amount: data.amount,
            deliveryPin: data.deliveryPin,
          },
          {
            ...baseOpts,
            jobId: `payment_success_${data.referenceCode}_sender_${data.senderEmail}`,
          },
        ),
      );
    }

    if (data.recipientEmail) {
      jobs.push(
        this.queue.add(
          PAYMENT_SUCCESS_EMAIL_JOB,
          {
            kind: 'recipient',
            to: data.recipientEmail,
            name: data.recipientName || 'Recipient',
            referenceCode: data.referenceCode,
            amount: data.amount,
            deliveryPin: data.deliveryPin,
          },
          {
            ...baseOpts,
            jobId: `payment_success_${data.referenceCode}_recipient_${data.recipientEmail}`,
          },
        ),
      );
    }

    if (data.businessEmail) {
      jobs.push(
        this.queue.add(
          PAYMENT_SUCCESS_EMAIL_JOB,
          {
            kind: 'business',
            to: data.businessEmail,
            name: data.businessName || 'Business',
            referenceCode: data.referenceCode,
            amount: data.amount,
          },
          {
            ...baseOpts,
            jobId: `payment_success_${data.referenceCode}_business_${data.businessEmail}`,
          },
        ),
      );
    }

    await Promise.all(jobs);
  }

  async enqueuePaymentFailedEmail(data: PaymentFailedEmailEnqueueData) {
    const jobs: Array<Promise<unknown>> = [];
    const baseOpts = {
      attempts: 5,
      backoff: {
        type: 'exponential' as const,
        delay: 3_000,
      },
    };

    if (data.senderEmail) {
      jobs.push(
        this.queue.add(
          PAYMENT_FAILED_EMAIL_JOB,
          {
            kind: 'sender',
            to: data.senderEmail,
            name: data.senderName || 'Customer',
            referenceCode: data.referenceCode,
            amount: data.amount,
            reason: data.reason,
          },
          {
            ...baseOpts,
            jobId: `payment_failed_${data.referenceCode}_sender_${data.senderEmail}`,
          },
        ),
      );
    }

    if (data.businessEmail) {
      jobs.push(
        this.queue.add(
          PAYMENT_FAILED_EMAIL_JOB,
          {
            kind: 'business',
            to: data.businessEmail,
            name: data.businessName || 'Business',
            referenceCode: data.referenceCode,
            amount: data.amount,
            reason: data.reason,
          },
          {
            ...baseOpts,
            jobId: `payment_failed_${data.referenceCode}_business_${data.businessEmail}`,
          },
        ),
      );
    }

    await Promise.all(jobs);
  }

  async enqueueOrderStatusEmail(data: OrderStatusEmailEnqueueData) {
    const NOTIFY_SENDER = new Set([
      'assigned',
      'cancelled',
      'en_route_pickup',
      'picked_up',
      'completed',
    ]);
    const NOTIFY_RECIPIENT = new Set([
      'assigned',
      'picked_up',
      'in_transit',
      'arrived_at_delivery',
      'completed',
    ]);

    const jobs: Array<Promise<unknown>> = [];
    const baseOpts = {
      attempts: 5,
      backoff: { type: 'exponential' as const, delay: 3_000 },
    };

    if (NOTIFY_SENDER.has(data.status) && data.senderEmail) {
      jobs.push(
        this.queue.add(
          ORDER_STATUS_EMAIL_JOB,
          {
            kind: 'sender',
            to: data.senderEmail,
            name: data.senderName || 'Customer',
            referenceCode: data.referenceCode,
            status: data.status,
            businessName: data.businessName,
            amount: data.amount,
            wasRefunded: data.wasRefunded,
            reason: data.reason,
          },
          {
            ...baseOpts,
            jobId: `order_status_${data.referenceCode}_${data.status}_sender`,
          },
        ),
      );
    }

    if (NOTIFY_RECIPIENT.has(data.status) && data.recipientEmail) {
      jobs.push(
        this.queue.add(
          ORDER_STATUS_EMAIL_JOB,
          {
            kind: 'recipient',
            to: data.recipientEmail,
            name: data.recipientName || 'Recipient',
            referenceCode: data.referenceCode,
            status: data.status,
          },
          {
            ...baseOpts,
            jobId: `order_status_${data.referenceCode}_${data.status}_recipient`,
          },
        ),
      );
    }

    await Promise.all(jobs);
  }

  async enqueueInvoiceEmail(data: InvoiceEmailEnqueueData) {
    await this.queue.add(
      INVOICE_EMAIL_JOB,
      {
        to: data.customerEmail,
        customerName: data.customerName,
        businessName: data.businessName,
        referenceCode: data.referenceCode,
        amount: data.amount,
        paymentLink: data.paymentLink,
        note: data.note,
        breakdown: data.breakdown,
      },
      {
        attempts: 5,
        backoff: { type: 'exponential' as const, delay: 3_000 },
        jobId: `invoice_${data.referenceCode}_${data.customerEmail}`,
      },
    );
  }
}
