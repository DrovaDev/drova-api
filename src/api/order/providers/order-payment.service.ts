import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { IResponse } from 'src/interfaces/response.interface';
import { successResponse } from 'src/helpers/response.helper';
import { OrderDb } from '../order.db';
import { Helpers } from 'src/helpers/random-generator';
import { OrderStatus, PaymentStatus, WalletOwnerType } from 'src/constants';
import { TransactionsService } from 'src/api/transactions/transactions.service';
import { WalletDb } from 'src/api/wallets/wallet.db';
import { PaymentEmailQueueProducer } from '../queues/payment-email.queue.producer';
import { AuthenticationDb } from 'src/api/authentication/authentication.db';
import { NeuronService } from 'src/services/neuron.service';

@Injectable()
export class OrderPaymentService {
  private readonly logger = new Logger(OrderPaymentService.name);

  constructor(
    private readonly orderDb: OrderDb,
    private readonly helpers: Helpers,
    private readonly walletDb: WalletDb,
    private readonly transactionsService: TransactionsService,
    private readonly paymentEmailQueue: PaymentEmailQueueProducer,
    private readonly authDb: AuthenticationDb,
    private readonly neuronService: NeuronService,
  ) {}

  private sendWhatsAppSafe(phone: string, message: string): void {
    this.neuronService
      .sendWhatsAppMessage(phone, message)
      .catch((err) =>
        this.logger.error(`Failed to send WhatsApp to ${phone}`, err),
      );
  }

  async processPaymentSuccess(
    paymentReference: string,
    webhookPayload: Record<string, any>,
  ): Promise<IResponse> {
    const order =
      await this.orderDb.findOrderByPaymentReference(paymentReference);

    if (!order) {
      throw new NotFoundException(
        `Order not found for payment reference: ${paymentReference}`,
      );
    }

    if (order.paymentStatus !== PaymentStatus.PENDING) {
      this.logger.warn(
        `Order ${order.id} already processed (status: ${order.paymentStatus})`,
      );
      return successResponse('Payment already processed', {
        orderId: order.id,
      });
    }

    const webhookAmount = webhookPayload?.data?.transaction?.transactionAmount;
    if (webhookAmount !== undefined) {
      const received = Number(webhookAmount);
      const expected = Number(order.totalAmount);
      if (Math.abs(received - expected) > 0.01) {
        this.logger.error(
          `AMOUNT MISMATCH — orderId=${order.id} ref=${paymentReference} ` +
            `expected=${expected} received=${received}. Payment NOT processed. Manual review required.`,
        );
        await this.orderDb.updateOrderPaymentStatus(
          order.id,
          PaymentStatus.FAILED,
        );
        return successResponse('Amount mismatch — payment not processed', {
          orderId: order.id,
        });
      }
    }

    const deliveryPin = this.helpers.generateOTP(6);

    // Mark payment received immediately so Nomba webhook retries don't double-process.
    // Run sequentially so a partial failure can't leave order in an inconsistent state.
    // Escrow runs below; if it fails we log for manual recovery but return 200.
    await this.orderDb.updateOrderPaymentStatus(order.id, PaymentStatus.HELD, {
      paidAt: new Date(),
      deliveryPin,
      escrowHeldAt: new Date(),
      webhookPayload,
    });
    await this.orderDb.updateOrderStatus(order.id, OrderStatus.CONFIRMED);

    const { businessWallet, clearingWallet } = await this.getEscrowWallets(
      order.businessId,
    );

    if (!businessWallet || !clearingWallet) {
      this.logger.error(
        `MANUAL ACTION REQUIRED — payment received but escrow skipped for order ${order.id} ` +
          `(ref=${paymentReference}, business=${order.businessId}). ` +
          `Missing: ${businessWallet ? '' : 'business wallet'}${clearingWallet ? '' : ' clearing wallet'}.`,
      );
    }

    try {
      if (!businessWallet || !clearingWallet) {
        throw new Error('wallet missing — skipping escrow');
      }

      const escrowResult = await this.transactionsService.escrowHold({
        orderId: order.id,
        businessWalletId: businessWallet.id,
        clearingWalletId: clearingWallet.id,
        amount: Number(order.totalAmount),
        metadata: {
          paymentReference,
          businessId: order.businessId,
          referenceCode: order.referenceCode,
        },
      });

      const journalId = escrowResult.data?.id;
      if (journalId) {
        await this.transactionsService.saveWebhookMeta({
          journalId,
          webhookMeta: webhookPayload,
        });
      }

      this.logger.log(
        `Payment processed for order ${order.id} — pin generated, escrow held`,
      );

      const businessEmail = await this.resolveBusinessEmail(
        order.business?.authId,
      );

      await this.paymentEmailQueue.enqueuePaymentSuccessEmail({
        senderEmail: order.parties?.guestEmail,
        senderName: order.parties?.guestFullName || 'Customer',
        recipientEmail: order.parties?.recipientEmail,
        recipientName: order.parties?.recipientFullName || 'Recipient',
        businessEmail,
        businessName: order.business?.businessName,
        referenceCode: order.referenceCode,
        amount: Number(order.totalAmount),
        deliveryPin,
        orderId: order.id,
      });

      if (order.parties?.guestContactNumber) {
        this.sendWhatsAppSafe(
          order.parties.guestContactNumber,
          `Hi ${order.parties.guestFullName || 'there'}, payment confirmed for order *${order.referenceCode}*.\n\nYour delivery PIN is: *${deliveryPin}*\n\nShare this code with the rider at the point of delivery to confirm receipt.`,
        );
      }

      return successResponse('Payment processed successfully', {
        orderId: order.id,
      });
    } catch (error) {
      this.logger.error(
        `Escrow/email step failed for order ${order.id} — order is HELD, payment was received`,
        error,
      );
      // Return 200 so Nomba stops retrying the webhook. The order is already marked HELD.
      return successResponse('Payment received', { orderId: order.id });
    }
  }

  async processPaymentFailed(
    paymentReference: string,
    webhookPayload: Record<string, any>,
  ): Promise<IResponse> {
    const order =
      await this.orderDb.findOrderByPaymentReference(paymentReference);

    if (!order) {
      this.logger.warn(
        `Order not found for failed payment reference: ${paymentReference}`,
      );
      return successResponse('Order not found — no action taken', null);
    }

    if (order.paymentStatus !== PaymentStatus.PENDING) {
      this.logger.warn(
        `Order ${order.id} not in PENDING state (status: ${order.paymentStatus}), skipping failure handling`,
      );
      return successResponse('Order already processed', { orderId: order.id });
    }

    await this.orderDb.updateOrderPaymentStatus(
      order.id,
      PaymentStatus.FAILED,
      {
        webhookPayload,
      },
    );

    try {
      await this.transactionsService.saveWebhookMeta({
        orderId: order.id,
        webhookMeta: webhookPayload,
      });
    } catch {
      // No journal yet for failed payments — that's fine
    }

    const reason =
      webhookPayload?.data?.transaction?.responseCode ||
      webhookPayload?.data?.transaction?.narration ||
      'Payment could not be processed';

    const businessEmail = await this.resolveBusinessEmail(
      order.business?.authId,
    );

    await this.paymentEmailQueue.enqueuePaymentFailedEmail({
      senderEmail: order.parties?.guestEmail,
      senderName: order.parties?.guestFullName || 'Customer',
      businessEmail,
      businessName: order.business?.businessName,
      referenceCode: order.referenceCode,
      amount: Number(order.totalAmount),
      reason,
    });

    this.logger.log(`Payment failed for order ${order.id}`);

    return successResponse('Payment failure processed', { orderId: order.id });
  }

  /**
   * Reverses the escrow hold on cancellation. Swallows its own errors so the
   * order stays CANCELLED even if the ledger step fails — logged for manual recovery.
   */
  async refundEscrowForCancellation(order: {
    id: string;
    businessId: string;
    totalAmount?: number;
    referenceCode: string;
    parties?: { guestEmail?: string; guestFullName?: string };
    business?: { authId?: string; businessName?: string };
  }): Promise<void> {
    const amount = Number(order.totalAmount ?? 0);

    try {
      const { businessWallet, clearingWallet } = await this.getEscrowWallets(
        order.businessId,
      );

      if (!businessWallet || !clearingWallet) {
        this.logger.error(
          `MANUAL ACTION REQUIRED — escrow refund skipped for cancelled order ${order.id}: wallet missing`,
        );
        return;
      }

      await this.transactionsService.escrowRefund({
        orderId: order.id,
        businessWalletId: businessWallet.id,
        clearingWalletId: clearingWallet.id,
        amount,
        metadata: {
          referenceCode: order.referenceCode,
          reason: 'order_cancelled',
        },
      });
    } catch (err) {
      this.logger.error(
        `Escrow refund failed for cancelled order ${order.id} — manual recovery required`,
        err,
      );
    }

    try {
      const customerEmail = order.parties?.guestEmail;
      if (customerEmail) {
        await this.paymentEmailQueue.enqueueOrderStatusEmail({
          status: 'cancelled',
          referenceCode: order.referenceCode,
          senderEmail: customerEmail,
          senderName: order.parties?.guestFullName ?? 'Customer',
          businessName: order.business?.businessName ?? 'Business',
          amount,
          wasRefunded: true,
        });
      }
    } catch (err) {
      this.logger.error(
        `Failed to enqueue cancellation email for order ${order.id}`,
        err,
      );
    }
  }

  /**
   * Releases escrow to the business once delivery is confirmed. Swallows its own
   * errors — the order is already marked COMPLETED by the caller, so a settlement
   * failure here must not roll that back; it's logged for manual recovery instead.
   */
  async settleEscrow(order: {
    id: string;
    businessId: string;
    totalAmount: number;
    platformCommission: number;
  }): Promise<void> {
    try {
      const { businessWallet, clearingWallet, platformWallet } =
        await this.getSettlementWallets(order.businessId);

      if (!businessWallet || !clearingWallet) {
        this.logger.error(
          `Wallets not found for settlement — orderId=${order.id} businessId=${order.businessId}`,
        );
        return;
      }

      await this.transactionsService.settleOrder({
        orderId: order.id,
        businessWalletId: businessWallet.id,
        platformWalletId: platformWallet?.id,
        clearingWalletId: clearingWallet.id,
        totalAmount: order.totalAmount,
        platformCommission: order.platformCommission,
        metadata: { businessId: order.businessId },
      });

      await this.orderDb.updateOrderPaymentStatus(
        order.id,
        PaymentStatus.RELEASED,
        { escrowReleasedAt: new Date() },
      );
    } catch (err) {
      this.logger.error(
        `Settlement failed for orderId=${order.id} — order is completed but escrow was not released`,
        err,
      );
    }
  }

  private async resolveBusinessEmail(
    businessAuthId?: string,
  ): Promise<string | undefined> {
    if (!businessAuthId) return undefined;
    const businessAuth = await this.authDb.findAuthById(businessAuthId);
    return businessAuth?.email;
  }

  private async getEscrowWallets(businessId: string) {
    const [businessWallet, clearingWallet] = await Promise.all([
      this.walletDb.findWalletByOwner(WalletOwnerType.BUSINESS, businessId),
      this.walletDb.findSystemWallet(WalletOwnerType.CLEARING),
    ]);
    return { businessWallet, clearingWallet };
  }

  private async getSettlementWallets(businessId: string) {
    const [businessWallet, clearingWallet, platformWallet] = await Promise.all([
      this.walletDb.findWalletByOwner(WalletOwnerType.BUSINESS, businessId),
      this.walletDb.findSystemWallet(WalletOwnerType.CLEARING),
      this.walletDb.findSystemWallet(WalletOwnerType.PLATFORM),
    ]);
    return { businessWallet, clearingWallet, platformWallet };
  }
}
