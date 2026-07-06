import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { OrderService } from 'src/api/order/providers/order.service';
import { TransactionsService } from 'src/api/transactions/transactions.service';
import { NombaService } from 'src/services/nomba.service';
import type { INombaWebhookPayload } from 'src/interfaces/nomba.interface';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from 'src/queues/queues.module';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);
  private readonly dedupeTtlSeconds = 60 * 60 * 24 * 7;
  private readonly processingLockTtlSeconds = 60 * 10;

  constructor(
    private readonly orderService: OrderService,
    private readonly transactionsService: TransactionsService,
    private readonly nombaService: NombaService,
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis,
  ) {}

  private buildProcessedKey(eventId: string): string {
    return `webhooks:processed:${eventId}`;
  }

  private buildProcessingLockKey(eventId: string): string {
    return `webhooks:processing:${eventId}`;
  }

  private async acquireEventProcessingLock(eventId: string): Promise<boolean> {
    const processedKey = this.buildProcessedKey(eventId);
    const alreadyProcessed = await this.redisClient.exists(processedKey);
    if (alreadyProcessed === 1) {
      return false;
    }

    const lockKey = this.buildProcessingLockKey(eventId);
    const lockResult = await this.redisClient.set(
      lockKey,
      String(Date.now()),
      'EX',
      this.processingLockTtlSeconds,
      'NX',
    );

    return lockResult === 'OK';
  }

  private async markEventProcessed(eventId: string): Promise<void> {
    const processedKey = this.buildProcessedKey(eventId);
    const lockKey = this.buildProcessingLockKey(eventId);

    await this.redisClient.set(
      processedKey,
      String(Date.now()),
      'EX',
      this.dedupeTtlSeconds,
    );
    await this.redisClient.del(lockKey);
  }

  private async releaseEventProcessingLock(eventId: string): Promise<void> {
    const lockKey = this.buildProcessingLockKey(eventId);
    await this.redisClient.del(lockKey);
  }

  // Nomba webhook handler
  async handleNombaEvent(
    payload: INombaWebhookPayload,
    headers: Record<string, string>,
  ) {
    console.log('Received Nomba webhook event:', payload);
    if (!this.nombaService.verifyWebhookSignature(payload, headers)) {
      this.logger.warn('Invalid Nomba webhook signature');
      throw new BadRequestException('Invalid signature');
    }

    const eventType = payload?.event_type;
    this.logger.log(`Detected Nomba event type: ${eventType}`);

    const eventId = `nomba:${payload?.requestId}`;
    const lockAcquired = await this.acquireEventProcessingLock(eventId);
    if (!lockAcquired) {
      this.logger.debug(`Skipping duplicate Nomba event: ${eventId}`);
      return { status: 'ok' };
    }

    try {
      switch (eventType) {
        case 'payment_success':
          await this.handlePaymentEvent(payload, true);
          break;
        case 'payment_failed':
        case 'payment_reversal':
          await this.handlePaymentEvent(payload, false);
          break;
        case 'payout_success':
          await this.handlePayoutEvent(payload, true);
          break;
        case 'payout_failed':
        case 'payout_refund':
          await this.handlePayoutEvent(payload, false);
          break;
        default:
          this.logger.warn(`Unhandled Nomba event type: ${eventType}`);
      }

      await this.markEventProcessed(eventId);
    } catch (error) {
      await this.releaseEventProcessingLock(eventId);
      this.logger.error(
        `Failed to process Nomba webhook eventId=${eventId} eventType=${eventType}`,
        error,
      );
      throw new InternalServerErrorException('Failed to process webhook event');
    }

    return { status: 'ok' };
  }

  private async handlePaymentEvent(
    payload: INombaWebhookPayload,
    successful: boolean,
  ): Promise<void> {
    const paymentReference = this.extractPaymentReference(payload);
    if (!paymentReference) {
      this.logger.warn(
        `Nomba payment event missing a payment reference, requestId=${payload?.requestId}`,
      );
      return;
    }

    if (successful) {
      await this.orderService.processPaymentSuccess(paymentReference, payload);
    } else {
      await this.orderService.processPaymentFailed(paymentReference, payload);
    }
  }

  private async handlePayoutEvent(
    payload: INombaWebhookPayload,
    successful: boolean,
  ): Promise<void> {
    const transaction = payload.data?.transaction as
      Record<string, any> | undefined;
    const merchantTxRef = transaction?.merchantTxRef as string | undefined;

    if (!merchantTxRef) {
      this.logger.warn(
        `Nomba payout event missing merchantTxRef requestId=${payload?.requestId}`,
      );
      return;
    }

    const providerReference =
      String(
        transaction?.transactionReference ?? transaction?.transactionId ?? '',
      ) || undefined;

    if (successful) {
      await this.transactionsService.processPayoutWebhookSuccess(
        merchantTxRef,
        providerReference,
      );
    } else {
      const isRefund = payload.event_type === 'payout_refund';
      await this.transactionsService.processPayoutWebhookFailed(
        merchantTxRef,
        isRefund,
      );
    }
  }

  /** Nomba's docs don't pin a single field name for the merchant reference across event shapes, so check known aliases. */
  private extractPaymentReference(
    payload: INombaWebhookPayload,
  ): string | undefined {
    const transaction = payload.data?.transaction as
      Record<string, any> | undefined;
    const order = (payload.data as Record<string, any>)?.order;

    return (
      order?.orderReference ??
      transaction?.merchantTxRef ??
      transaction?.orderReference ??
      transaction?.transactionId
    );
  }
}
