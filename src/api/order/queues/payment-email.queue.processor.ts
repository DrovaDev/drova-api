import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { EmailService } from 'src/services/email.service';
import {
  PAYMENT_EMAIL_QUEUE,
  PAYMENT_SUCCESS_EMAIL_JOB,
  PAYMENT_FAILED_EMAIL_JOB,
  INVOICE_EMAIL_JOB,
  ORDER_STATUS_EMAIL_JOB,
  type PaymentSuccessEmailJobData,
  type PaymentFailedEmailJobData,
  type InvoiceEmailJobData,
  type OrderStatusEmailJobData,
} from './payment-email.queue.constants';

@Processor(PAYMENT_EMAIL_QUEUE)
export class PaymentEmailQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(PaymentEmailQueueProcessor.name);

  constructor(private readonly emailService: EmailService) {
    super();
  }

  async process(
    job: Job<
      | PaymentSuccessEmailJobData
      | PaymentFailedEmailJobData
      | InvoiceEmailJobData
      | OrderStatusEmailJobData
    >,
  ) {
    switch (job.name) {
      case PAYMENT_SUCCESS_EMAIL_JOB:
        await this.handlePaymentSuccess(job as Job<PaymentSuccessEmailJobData>);
        break;

      case PAYMENT_FAILED_EMAIL_JOB:
        await this.handlePaymentFailed(job as Job<PaymentFailedEmailJobData>);
        break;

      case INVOICE_EMAIL_JOB:
        await this.handleInvoiceEmail(job as Job<InvoiceEmailJobData>);
        break;

      case ORDER_STATUS_EMAIL_JOB:
        await this.handleOrderStatus(job as Job<OrderStatusEmailJobData>);
        break;

      default:
        this.logger.warn(`Unhandled job name: ${job.name}`);
    }
  }

  private async handlePaymentSuccess(job: Job<PaymentSuccessEmailJobData>) {
    const { kind, to, name, referenceCode, amount, deliveryPin, orderId } = job.data;

    if (kind === 'business') {
      await this.emailService.sendBusinessPaymentSuccessEmail({
        to,
        businessName: name,
        referenceCode,
        amount,
        orderId,
      });
    } else {
      await this.emailService.sendPaymentSuccessEmail({
        to,
        recipientName: name,
        referenceCode,
        amount,
        deliveryPin,
      });
    }

    this.logger.log(
      `Payment success email sent (${kind}) to: ${to} for order ${referenceCode}`,
    );
  }

  private async handlePaymentFailed(job: Job<PaymentFailedEmailJobData>) {
    const { kind, to, name, referenceCode, amount, reason } = job.data;

    if (kind === 'business') {
      await this.emailService.sendBusinessPaymentFailedEmail({
        to,
        businessName: name,
        referenceCode,
        amount,
        reason,
      });
    } else {
      await this.emailService.sendPaymentFailedEmail({
        to,
        recipientName: name,
        referenceCode,
        amount,
        reason,
      });
    }

    this.logger.log(
      `Payment failed email sent (${kind}) to: ${to} for order ${referenceCode}`,
    );
  }

  private async handleInvoiceEmail(job: Job<InvoiceEmailJobData>) {
    const {
      to,
      customerName,
      businessName,
      referenceCode,
      amount,
      paymentLink,
      note,
      breakdown,
    } = job.data;

    await this.emailService.sendInvoiceEmail({
      to,
      customerName,
      businessName,
      referenceCode,
      amount,
      paymentLink,
      note,
      breakdown,
    });

    this.logger.log(`Invoice email sent to: ${to} for order ${referenceCode}`);
  }

  private async handleOrderStatus(job: Job<OrderStatusEmailJobData>) {
    const {
      kind,
      to,
      name,
      referenceCode,
      status,
      businessName,
      amount,
      wasRefunded,
      reason,
    } = job.data;

    await this.emailService.sendOrderStatusEmail({
      to,
      name,
      referenceCode,
      status,
      kind,
      businessName,
      amount,
      wasRefunded,
      reason,
    });

    this.logger.log(
      `Order status email (${status}/${kind}) sent to: ${to} for order ${referenceCode}`,
    );
  }
}
