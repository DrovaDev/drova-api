import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { NotificationDb } from './notification.db';
import { PushNotificationService } from 'src/services/push-notification.service';
import {
  RegisterDeviceTokenDTO,
  RemoveDeviceTokenDTO,
} from './dtos/device-token.dto';
import { InAppNotificationType } from 'src/constants';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly notificationDb: NotificationDb,
    private readonly pushNotificationService: PushNotificationService,
  ) {}

  // ─── Device token management ────────────────────────────────────────────────

  async registerDeviceToken(authId: string, payload: RegisterDeviceTokenDTO) {
    return await this.notificationDb.registerDeviceToken({
      authId,
      deviceId: payload.deviceId,
      deviceToken: payload.deviceToken,
    });
  }

  async removeDeviceToken(authId: string, payload: RemoveDeviceTokenDTO) {
    if (!payload.deviceToken) {
      throw new BadRequestException('deviceToken is required');
    }

    const removed = await this.notificationDb.deactivateDeviceToken({
      authId,
      deviceToken: payload.deviceToken,
    });

    return {
      status: 'success',
      statusCode: 200,
      message: removed
        ? 'Device token removed successfully'
        : 'Device token not found',
      data: { removed },
    };
  }

  async getMyActiveDeviceTokens(authId: string) {
    const tokens =
      await this.notificationDb.getActiveDeviceTokensByAuthId(authId);
    return {
      status: 'success',
      statusCode: 200,
      message: tokens.length
        ? 'Tokens fetched successfully'
        : 'No tokens found',
      data: tokens,
    };
  }

  // ─── Push notification send methods ─────────────────────────────────────────

  async notifyRiderNewOffer(
    authId: string,
    orderId: string,
    offerId: string,
  ): Promise<void> {
    await Promise.all([
      this.sendToAuthId(authId, {
        title: 'New Delivery Request',
        body: 'You have a new delivery offer. Tap to view and accept.',
        data: { type: InAppNotificationType.ORDER_OFFER, orderId, offerId },
      }),
      this.notificationDb.createInAppNotification({
        authId,
        type: InAppNotificationType.ORDER_OFFER,
        title: 'New Delivery Request',
        body: 'You have a new delivery offer. Tap to view and accept.',
        data: { orderId, offerId },
      }),
    ]);
  }

  async notifyRiderOrderAssigned(
    authId: string,
    orderId: string,
  ): Promise<void> {
    await Promise.all([
      this.sendToAuthId(authId, {
        title: 'Order Assigned',
        body: 'You have been assigned a new delivery. Tap to view details.',
        data: { type: InAppNotificationType.ORDER_ASSIGNED, orderId },
      }),
      this.notificationDb.createInAppNotification({
        authId,
        type: InAppNotificationType.ORDER_ASSIGNED,
        title: 'Order Assigned',
        body: 'You have been assigned a new delivery. Tap to view details.',
        data: { orderId },
      }),
    ]);
  }

  async notifyRiderOrderStatusUpdate(
    authId: string,
    orderId: string,
    status: string,
  ): Promise<void> {
    const body = `Your order status has been updated to ${status.replaceAll('_', ' ')}.`;
    await Promise.all([
      this.sendToAuthId(authId, {
        title: 'Order Update',
        body,
        data: { type: InAppNotificationType.ORDER_STATUS_UPDATE, orderId, status },
      }),
      this.notificationDb.createInAppNotification({
        authId,
        type: InAppNotificationType.ORDER_STATUS_UPDATE,
        title: 'Order Update',
        body,
        data: { orderId, status },
      }),
    ]);
  }

  async notifyRiderOrderCompleted(
    authId: string,
    orderId: string,
  ): Promise<void> {
    await Promise.all([
      this.sendToAuthId(authId, {
        title: 'Delivery Confirmed',
        body: 'The delivery has been confirmed by the recipient. Well done!',
        data: { type: InAppNotificationType.ORDER_COMPLETED, orderId },
      }),
      this.notificationDb.createInAppNotification({
        authId,
        type: InAppNotificationType.ORDER_COMPLETED,
        title: 'Delivery Confirmed',
        body: 'The delivery has been confirmed by the recipient. Well done!',
        data: { orderId },
      }),
    ]);
  }

  async notifyRiderOrderUnassigned(
    authId: string,
    orderId: string,
  ): Promise<void> {
    await Promise.all([
      this.sendToAuthId(authId, {
        title: 'Order Reassigned',
        body: 'This order has been reassigned to another rider.',
        data: { type: InAppNotificationType.ORDER_UNASSIGNED, orderId },
      }),
      this.notificationDb.createInAppNotification({
        authId,
        type: InAppNotificationType.ORDER_UNASSIGNED,
        title: 'Order Reassigned',
        body: 'This order has been reassigned to another rider.',
        data: { orderId },
      }),
    ]);
  }

  async notifyBusinessOfferExpired(
    authId: string,
    orderId: string,
    referenceCode: string,
  ): Promise<void> {
    await this.notificationDb.createInAppNotification({
      authId,
      type: InAppNotificationType.ORDER_OFFER_EXPIRED,
      title: 'Rider Did Not Respond',
      body: `The rider did not accept order ${referenceCode} within 5 minutes. Please reassign.`,
      data: { orderId, referenceCode },
    });
  }

  async notifyBusinessOfferRejected(
    authId: string,
    orderId: string,
    referenceCode: string,
  ): Promise<void> {
    await this.notificationDb.createInAppNotification({
      authId,
      type: InAppNotificationType.ORDER_OFFER_REJECTED,
      title: 'Rider Declined Order',
      body: `The rider declined order ${referenceCode}. Please reassign to another rider.`,
      data: { orderId, referenceCode },
    });
  }

  async notifyRiderWalletCredited(
    authId: string,
    amount: number,
  ): Promise<void> {
    const formatted = new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(amount);

    await Promise.all([
      this.sendToAuthId(authId, {
        title: 'Wallet Credited',
        body: `Your wallet has been credited with ${formatted}.`,
        data: { type: InAppNotificationType.WALLET_CREDITED, amount: String(amount) },
      }),
      this.notificationDb.createInAppNotification({
        authId,
        type: InAppNotificationType.WALLET_CREDITED,
        title: 'Wallet Credited',
        body: `Your wallet has been credited with ${formatted}.`,
        data: { amount: String(amount) },
      }),
    ]);
  }

  async notifyBusinessNewOrder(
    authId: string,
    orderId: string,
    referenceCode: string,
  ): Promise<void> {
    await this.notificationDb.createInAppNotification({
      authId,
      type: InAppNotificationType.NEW_ORDER,
      title: 'New Quote Request',
      body: `Order ${referenceCode} has been placed. Review and send an invoice to get started.`,
      data: { orderId, referenceCode },
    });
  }

  async getInAppNotifications(
    authId: string,
    opts: { unreadOnly?: boolean; limit?: number; page?: number },
  ) {
    const limit = opts.limit ?? 20;
    const offset = ((opts.page ?? 1) - 1) * limit;
    const { notifications, count } =
      await this.notificationDb.getInAppNotifications({
        authId,
        unreadOnly: opts.unreadOnly,
        limit,
        offset,
      });
    const totalPages = Math.ceil(count / limit);
    return { notifications, count, totalPages };
  }

  async markNotificationAsRead(id: string, authId: string): Promise<boolean> {
    return await this.notificationDb.markAsRead({ id, authId });
  }

  async markAllNotificationsAsRead(authId: string): Promise<number> {
    return await this.notificationDb.markAllAsRead(authId);
  }

  async getUnreadCount(authId: string): Promise<number> {
    return await this.notificationDb.getUnreadCount(authId);
  }

  // ─── Private helper ──────────────────────────────────────────────────────────

  private async sendToAuthId(
    authId: string,
    notification: { title: string; body: string; data: Record<string, string> },
  ): Promise<void> {
    try {
      const tokens =
        await this.notificationDb.getActiveDeviceTokensByAuthId(authId);
      if (!tokens.length) return;

      await this.pushNotificationService.sendMulticastNotification(
        tokens.map((t) => t.deviceToken),
        notification.title,
        notification.body,
        notification.data,
      );
    } catch (err) {
      this.logger.error(
        `Failed to send push notification to authId=${authId} type=${notification.data.type}`,
        err,
      );
    }
  }
}
