import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { IResponse } from 'src/interfaces/response.interface';
import { successResponse } from 'src/helpers/response.helper';
import { OrderDb } from '../order.db';
import { Helpers } from 'src/helpers/random-generator';
import {
  CreateOrderDTO,
  CreateDirectOrderDTO,
  OrderQueryDTO,
  ManuallyAssingOrderDTO,
  SendInvoiceDTO,
  CancelOrderDTO,
  ResendTrackingDTO,
} from '../dtos/order.dto';
import { UtilsService } from 'src/helpers/utils.service';
import {
  OrderStatus,
  PaymentStatus,
  PickupMethod,
  UserType,
  CancelledBy,
  BusinessOperatingStatus,
  BusinessDayOfWeek,
} from 'src/constants';
import type { BusinessOperatingHour } from 'src/constants';
import { RiderDb } from 'src/api/rider/rider.db';
import type { ITokenPayload } from 'src/interfaces/token.interface';
import { NombaService } from 'src/services/nomba.service';
import { PaymentEmailQueueProducer } from '../queues/payment-email.queue.producer';
import { OrderOfferQueueProducer } from '../queues/order-offer.queue.producer';
import { NotificationService } from 'src/api/notification/notification.service';
import { BusinessDb } from 'src/api/business/business.db';
import { AuthenticationDb } from 'src/api/authentication/authentication.db';
import { OFFER_EXPIRY_MS } from '../queues/order-offer.queue.constants';
import { OrderPricingService } from './order-pricing.service';
import { OrderPaymentService } from './order-payment.service';
import { Orders } from '../schemas/order.schema';
import { EmailService } from 'src/services/email.service';

const BUSINESS_ORDER_SORT_FIELDS = new Set([
  'createdAt',
  'updatedAt',
  'status',
  'deliveryFee',
  'totalAmount',
  'paymentStatus',
  'deliveryPriority',
  'referenceCode',
]);

const RIDER_ORDER_SORT_FIELDS = new Set([
  'createdAt',
  'updatedAt',
  'status',
  'deliveryFee',
  'totalAmount',
  'paymentStatus',
  'referenceCode',
]);

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    private readonly orderDb: OrderDb,
    private readonly helpers: Helpers,
    private readonly utilService: UtilsService,
    private readonly nombaService: NombaService,
    private readonly riderDb: RiderDb,
    private readonly paymentEmailQueue: PaymentEmailQueueProducer,
    private readonly orderOfferQueue: OrderOfferQueueProducer,
    private readonly notificationService: NotificationService,
    private readonly businessDb: BusinessDb,
    private readonly authDb: AuthenticationDb,
    private readonly orderPricingService: OrderPricingService,
    private readonly orderPaymentService: OrderPaymentService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Submit a quotation request. No fee is calculated — the business will review
   * and send an invoice with the price before the customer pays.
   */
  async createOrder(
    auth: ITokenPayload | null,
    payload: CreateOrderDTO,
  ): Promise<IResponse> {
    if (
      !payload.senderDetails.guestEmail ||
      !payload.senderDetails.guestContactNumber ||
      !payload.senderDetails.guestFullName
    ) {
      throw new BadRequestException(
        'Sender details must include email, contact number, and full name',
      );
    }

    try {
      const business = await this.resolveBusiness(auth, payload.businessSlug);

      if (!business) {
        throw new NotFoundException('Business not found');
      }

      const businessId = business.id;

      this.assertBusinessIsOpen(business.operatingHours);

      const referenceCode = this.helpers.generateOrderReference();

      const savedOrder = await this.orderDb.createOrderTransaction({
        order: {
          referenceCode,
          businessId,
          status: OrderStatus.PENDING,
          pickupMethod: payload.pickupMethod,
          deliveryPriority: payload.deliveryPriority,
          prefferedDeliveryTime: payload.preferredDeliveryTime
            ? new Date(payload.preferredDeliveryTime)
            : undefined,
          customerNote: payload.customerNote,
          pickupInstructions: payload.pickupInstructions,
          deliveryInstructions: payload.deliveryInstructions,
          deliveryFee: 0,
        },
        items: payload.items.map((item) => ({
          packageName: item.packageName,
          packageDescription: item.packageDescription,
          packageType: item.packageType,
          quantity: item.quantity,
          estimatedValue: item.estimatedValue,
          estimatedWeight: item.estimatedWeight ?? null,
          specialInstructions: item.specialInstructions ?? null,
        })),
        parties: {
          guestFullName: payload.senderDetails.guestFullName,
          guestContactNumber: payload.senderDetails.guestContactNumber,
          guestEmail: payload.senderDetails.guestEmail,
          recipientFullName: payload.recipientDetails.recipientFullName,
          recipientContactNumber:
            payload.recipientDetails.recipientContactNumber,
          recipientEmail: payload.recipientDetails.recipientEmail,
        },
        locations: {
          pickupAddress: payload.pickupDetails.pickupAddress,
          pickupCoordinates: {
            type: 'Point',
            coordinates: payload.pickupDetails.pickupCoordinates,
          },
          pickupCity: payload.pickupDetails.pickupCity,
          pickupState: payload.pickupDetails.pickupState,
          pickupNearestLandmark: payload.pickupDetails.pickupNearestLandmark,
          pickupContactPersonName:
            payload.pickupDetails.pickupContactPersonName,
          pickupContactPersonPhone:
            payload.pickupDetails.pickupContactPersonPhoneNumber,
          deliveryAddress: payload.deliveryDetails.deliveryAddress,
          deliveryCoordinates: {
            type: 'Point',
            coordinates: payload.deliveryDetails.deliveryCoordinates,
          },
          deliveryState: payload.deliveryDetails.deliveryState,
          deliveryNearestLandmark:
            payload.deliveryDetails.deliveryNearestLandmark,
        },
      });

      // Fire-and-forget: notify the business of the new order via in-app + email
      this.authDb
        .findAuthById(business.authId)
        .then((auth) => {
          const notifications: Promise<void>[] = [
            this.notificationService.notifyBusinessNewOrder(
              business.authId,
              savedOrder.id,
              referenceCode,
            ),
          ];
          if (auth?.email) {
            notifications.push(
              this.emailService.sendNewOrderEmail({
                to: auth.email,
                businessName: business.businessName,
                referenceCode,
                customerName: payload.senderDetails.guestFullName,
              }),
            );
          }
          return Promise.all(notifications);
        })
        .catch((err) =>
          this.logger.warn(
            `Failed to notify business of new order ${referenceCode}`,
            err,
          ),
        );

      return successResponse('Quotation submitted successfully', savedOrder, {
        statusCode: 201,
      });
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      this.logger.error('Failed to submit quotation', error);
      throw new InternalServerErrorException('Failed to submit quotation');
    }
  }

  /**
   * Throws BadRequestException if the business's configured operating hours
   * indicate it is currently closed. WAT (UTC+1) is used as the local time.
   * No-op when operatingHours is empty/null (no restriction configured).
   */
  private assertBusinessIsOpen(operatingHours: BusinessOperatingHour[] | undefined | null): void {
    if (!operatingHours?.length) return;

    // Shift UTC into WAT (UTC+1) without an external library
    const nowWat = new Date(Date.now() + 60 * 60 * 1000);

    const DAY_NAMES: BusinessDayOfWeek[] = [
      BusinessDayOfWeek.SUNDAY,
      BusinessDayOfWeek.MONDAY,
      BusinessDayOfWeek.TUESDAY,
      BusinessDayOfWeek.WEDNESDAY,
      BusinessDayOfWeek.THURSDAY,
      BusinessDayOfWeek.FRIDAY,
      BusinessDayOfWeek.SATURDAY,
    ];
    const todayName = DAY_NAMES[nowWat.getUTCDay()];
    const currentMinutes = nowWat.getUTCHours() * 60 + nowWat.getUTCMinutes();

    const todayEntry = operatingHours.find((h) => h.day === todayName);
    if (!todayEntry) return; // day not configured → no restriction

    if (todayEntry.status === BusinessOperatingStatus.CLOSED) {
      throw new BadRequestException(
        'This business is currently closed and is not accepting orders.',
      );
    }

    // OPEN but no window set → open all day
    if (!todayEntry.opensAt || !todayEntry.closesAt) return;

    const [openH, openM] = todayEntry.opensAt.split(':').map(Number);
    const [closeH, closeM] = todayEntry.closesAt.split(':').map(Number);
    const opensAtMinutes = openH * 60 + openM;
    const closesAtMinutes = closeH * 60 + closeM;

    if (currentMinutes < opensAtMinutes || currentMinutes >= closesAtMinutes) {
      throw new BadRequestException(
        `This business is currently closed. Today's operating hours are ${todayEntry.opensAt}–${todayEntry.closesAt} WAT.`,
      );
    }
  }

  /**
   * Resolves the Business entity for an incoming order.
   * - Authenticated business: looked up by auth.businessId from the token.
   * - Guest / rider: looked up by the slug submitted in the payload.
   */
  private async resolveBusiness(
    auth: ITokenPayload | null,
    businessSlug?: string,
  ) {
    if (auth?.userType === UserType.BUSINESS && auth.businessId) {
      return this.businessDb.findById(auth.businessId);
    }

    if (!businessSlug) {
      throw new BadRequestException('businessSlug is required');
    }

    return this.businessDb.findBySlug(businessSlug);
  }

  async createDirectOrder(
    auth: ITokenPayload,
    payload: CreateDirectOrderDTO,
  ): Promise<IResponse> {
    if (!auth.businessId) {
      throw new ForbiddenException('Business context is required');
    }

    const business = await this.businessDb.findById(auth.businessId);
    if (!business) throw new NotFoundException('Business not found');

    const pickupFee = payload.pickupFee ?? 0;
    const packagingFee = payload.packagingFee ?? 0;

    if (pickupFee > 0 && payload.pickupMethod !== PickupMethod.BUSINESS_PICKUP) {
      throw new BadRequestException(
        'Pickup fee only applies when pickupMethod is business_pickup',
      );
    }

    const referenceCode = this.helpers.generateOrderReference();

    const savedOrder = await this.orderDb.createOrderTransaction({
      order: {
        referenceCode,
        businessId: auth.businessId,
        status: OrderStatus.PENDING,
        pickupMethod: payload.pickupMethod,
        deliveryPriority: payload.deliveryPriority,
        prefferedDeliveryTime: payload.preferredDeliveryTime
          ? new Date(payload.preferredDeliveryTime)
          : undefined,
        customerNote: payload.customerNote,
        pickupInstructions: payload.pickupInstructions,
        deliveryInstructions: payload.deliveryInstructions,
        deliveryFee: 0,
      },
      items: payload.items.map((item) => ({
        packageName: item.packageName,
        packageDescription: item.packageDescription,
        packageType: item.packageType,
        quantity: item.quantity,
        estimatedValue: item.estimatedValue,
        estimatedWeight: item.estimatedWeight ?? null,
        specialInstructions: item.specialInstructions ?? null,
      })),
      parties: {
        guestFullName: payload.senderDetails.guestFullName,
        guestContactNumber: payload.senderDetails.guestContactNumber,
        guestEmail: payload.senderDetails.guestEmail,
        recipientFullName: payload.recipientDetails.recipientFullName,
        recipientContactNumber: payload.recipientDetails.recipientContactNumber,
        recipientEmail: payload.recipientDetails.recipientEmail,
      },
      locations: {
        pickupAddress: payload.pickupDetails.pickupAddress,
        pickupCoordinates: {
          type: 'Point',
          coordinates: payload.pickupDetails.pickupCoordinates,
        },
        pickupCity: payload.pickupDetails.pickupCity,
        pickupState: payload.pickupDetails.pickupState,
        pickupNearestLandmark: payload.pickupDetails.pickupNearestLandmark,
        pickupContactPersonName: payload.pickupDetails.pickupContactPersonName,
        pickupContactPersonPhone:
          payload.pickupDetails.pickupContactPersonPhoneNumber,
        deliveryAddress: payload.deliveryDetails.deliveryAddress,
        deliveryCoordinates: {
          type: 'Point',
          coordinates: payload.deliveryDetails.deliveryCoordinates,
        },
        deliveryState: payload.deliveryDetails.deliveryState,
        deliveryNearestLandmark: payload.deliveryDetails.deliveryNearestLandmark,
      },
    });

    if (payload.paymentMethod === 'online') {
      const priceBreakdown = this.orderPricingService.calculateInvoicePricing({
        deliveryFee: payload.deliveryFee,
        pickupFee,
        packagingFee,
      });
      const { serviceFee, totalAmount } = priceBreakdown;

      const paymentReference = this.helpers.generateTxReference();
      const checkoutOrder = await this.nombaService.createCheckoutOrder({
        amount: totalAmount,
        orderReference: paymentReference,
        customerEmail: payload.senderDetails.guestEmail,
      });

      const updatedOrder = await this.orderDb.updateOrderForInvoice({
        orderId: savedOrder.id,
        businessId: auth.businessId,
        deliveryFee: payload.deliveryFee,
        pickupFee,
        packagingFee,
        serviceFee,
        platformCommission: serviceFee,
        paymentReference,
        paymentLink: checkoutOrder.checkoutLink,
        totalAmount,
        priceBreakdown,
        invoiceSentAt: new Date(),
      });

      this.paymentEmailQueue
        .enqueueInvoiceEmail({
          customerEmail: payload.senderDetails.guestEmail,
          customerName: payload.senderDetails.guestFullName,
          businessName: business.businessName,
          referenceCode,
          amount: totalAmount,
          paymentLink: checkoutOrder.checkoutLink,
          note: payload.note,
          breakdown: priceBreakdown,
        })
        .catch((err) =>
          this.logger.warn(`Failed to enqueue invoice email for ${referenceCode}`, err),
        );

      return successResponse('Order created. Share the payment link with your customer.', {
        ...updatedOrder,
        paymentLink: checkoutOrder.checkoutLink,
      }, { statusCode: 201 });
    }

    // cash | bank_transfer — mark as already paid, ready for rider assignment
    const priceBreakdown = this.orderPricingService.calculateInvoicePricing(
      { deliveryFee: payload.deliveryFee, pickupFee, packagingFee },
      { includeNombaFee: false },
    );
    const { serviceFee, totalAmount } = priceBreakdown;
    const deliveryPin = this.helpers.generateOTP(6);

    const confirmedOrder = await this.orderDb.confirmManualOrder({
      orderId: savedOrder.id,
      businessId: auth.businessId,
      deliveryFee: payload.deliveryFee,
      pickupFee,
      packagingFee,
      serviceFee,
      platformCommission: serviceFee,
      totalAmount,
      priceBreakdown,
      deliveryPin,
      paymentMethod: payload.paymentMethod,
    });

    return successResponse(
      'Order created and marked as paid. You can now assign a rider.',
      confirmedOrder,
      { statusCode: 201 },
    );
  }

  async getBusinessOrders(
    businessId: string,
    query: OrderQueryDTO,
  ): Promise<IResponse> {
    if (!businessId) {
      throw new BadRequestException('Business context is required');
    }

    const { sortBy, sortOrder, offset, limit, page } = this.resolveListParams(
      query,
      BUSINESS_ORDER_SORT_FIELDS,
    );

    try {
      const { orders, count } = await this.orderDb.listBusinessOrders({
        businessId,
        search: query?.search,
        status: query?.status,
        paymentStatus: query?.paymentStatus,
        pickupMethod: query?.pickupMethod,
        deliveryPriority: query?.deliveryPriority,
        startDate: query?.startDate,
        endDate: query?.endDate,
        offset,
        limit,
        sortBy,
        sortOrder,
      });

      return this.buildListResponse(orders, count, page, limit);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('Failed to fetch business orders', error);
      throw new InternalServerErrorException('Failed to fetch orders');
    }
  }

  async getRiderOrders(
    riderId: string,
    query: OrderQueryDTO,
  ): Promise<IResponse> {
    if (!riderId) {
      throw new BadRequestException('Rider context is required');
    }

    const { sortBy, sortOrder, offset, limit, page } = this.resolveListParams(
      query,
      RIDER_ORDER_SORT_FIELDS,
    );

    try {
      const { orders, count } = await this.orderDb.listRiderOrders({
        riderId,
        search: query?.search,
        status: query?.status as OrderStatus | undefined,
        paymentStatus: query?.paymentStatus,
        startDate: query?.startDate,
        endDate: query?.endDate,
        offset,
        limit,
        sortBy,
        sortOrder,
      });

      return this.buildListResponse(orders, count, page, limit);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('Failed to fetch rider orders', error);
      throw new InternalServerErrorException('Failed to fetch orders');
    }
  }

  /** Resolves pagination + whitelisted sort params shared by every order listing endpoint. */
  private resolveListParams(
    query: OrderQueryDTO,
    allowedSortFields: Set<string>,
  ): {
    sortBy: string;
    sortOrder: 'ASC' | 'DESC';
    page: number;
    limit: number;
    offset: number;
  } {
    const page = query?.page || 1;
    const limit = query?.limit || 20;
    const { offset } = this.utilService.getPaginationData({ page, limit }, 0);

    const requestedSortBy = query?.sortBy ? String(query.sortBy) : 'createdAt';
    const sortBy = allowedSortFields.has(requestedSortBy)
      ? requestedSortBy
      : 'createdAt';
    const sortOrder = query?.sortOrder === 'asc' ? 'ASC' : 'DESC';

    return { sortBy, sortOrder, page, limit, offset };
  }

  private buildListResponse(
    orders: Orders[],
    count: number,
    page: number,
    limit: number,
  ): IResponse {
    const { totalPages } = this.utilService.getPaginationData(
      { page, limit },
      count,
    );
    const message =
      orders.length > 0 ? 'Orders fetched successfully' : 'No orders found';

    return successResponse(message, orders, {
      meta: { count, totalPages, currentPage: page, limit },
    });
  }

  async manuallyAssignOrderToRider(
    businessId: string,
    payload: ManuallyAssingOrderDTO,
  ): Promise<IResponse> {
    if (!businessId) {
      throw new BadRequestException('Business context is required');
    }

    const order = await this.orderDb.findOrderById({
      orderId: payload.orderId,
      businessId,
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Order has been cancelled');
    }

    if (order.status === OrderStatus.COMPLETED) {
      throw new BadRequestException('Order has already been completed');
    }

    const allowedStatus = [
      OrderStatus.CONFIRMED,
      OrderStatus.OFFER_PENDING,
      OrderStatus.ASSIGNED,
    ];
    if (!allowedStatus.includes(order.status)) {
      throw new BadRequestException('Order cannot be assigned at this stage');
    }

    if (order.paymentStatus !== PaymentStatus.HELD) {
      throw new BadRequestException(
        'Order cannot be assigned before payment is received',
      );
    }

    const rider = await this.riderDb.findRiderById(businessId, payload.riderId);
    if (!rider) {
      throw new NotFoundException('Rider not found');
    }

    const business = await this.businessDb.findById(businessId);
    const businessEmail = await this.authDb
      .findAuthById(business?.authId ?? '')
      .then((a) => a?.email);

    const displacedRiderId = order.riderId;
    const offerExpiresAt = new Date(Date.now() + OFFER_EXPIRY_MS);

    await this.orderDb.offerOrderToRider({
      orderId: payload.orderId,
      riderId: payload.riderId,
      offerExpiresAt,
    });

    const notifications: Promise<void>[] = [
      this.notificationService.notifyRiderNewOffer(
        rider.authId,
        payload.orderId,
        `${payload.orderId}_${rider.id}`,
      ),
      this.orderOfferQueue.enqueueOfferExpiry({
        orderId: payload.orderId,
        riderId: payload.riderId,
        businessId,
        businessAuthId: business?.authId ?? '',
        businessEmail,
        referenceCode: order.referenceCode,
      }),
    ];

    if (displacedRiderId && displacedRiderId !== payload.riderId) {
      const displacedRider = await this.riderDb.findRiderById(
        businessId,
        displacedRiderId,
      );
      if (displacedRider?.authId) {
        notifications.push(
          this.notificationService.notifyRiderOrderUnassigned(
            displacedRider.authId,
            payload.orderId,
          ),
        );
      }
    }

    await Promise.all(notifications);

    return successResponse(
      'Order offer sent to rider. Waiting for acceptance.',
      { orderId: payload.orderId, riderId: payload.riderId, offerExpiresAt },
    );
  }

  async acceptOrderOffer(
    orderId: string,
    auth: ITokenPayload,
  ): Promise<IResponse> {
    if (!auth.riderId) {
      throw new ForbiddenException('Rider context is required');
    }

    const accepted = await this.orderDb.acceptOrderOffer({
      orderId,
      riderId: auth.riderId,
    });

    if (!accepted) {
      throw new BadRequestException(
        'Offer is no longer available — it may have expired or been reassigned',
      );
    }

    // Fire-and-forget: notify sender and recipient that a rider has been assigned
    this.orderDb.findOrderById({ orderId })
      .then((order) => {
        if (!order?.parties) return;
        return this.paymentEmailQueue.enqueueOrderStatusEmail({
          status: OrderStatus.ASSIGNED,
          referenceCode: order.referenceCode,
          senderEmail: order.parties.guestEmail,
          senderName: order.parties.guestFullName,
          recipientEmail: order.parties.recipientEmail,
          recipientName: order.parties.recipientFullName,
        });
      })
      .catch((err) =>
        this.logger.warn(
          `Failed to queue order-assigned emails for order ${orderId}`,
          err,
        ),
      );

    return successResponse('Order accepted successfully', { orderId });
  }

  async rejectOrderOffer(
    orderId: string,
    auth: ITokenPayload,
  ): Promise<IResponse> {
    if (!auth.riderId) {
      throw new ForbiddenException('Rider context is required');
    }

    const order = await this.orderDb.findOrderById({ orderId });
    if (order?.riderId !== auth.riderId) {
      throw new BadRequestException(
        'No active offer found for this order',
      );
    }

    const expired = await this.orderDb.expireOrderOffer({
      orderId,
      riderId: auth.riderId,
    });

    if (!expired) {
      throw new BadRequestException(
        'Offer is no longer available — it may have already expired or been reassigned',
      );
    }

    const business = await this.businessDb.findById(order.businessId);
    if (business?.authId) {
      await Promise.allSettled([
        this.notificationService.notifyBusinessOfferRejected(
          business.authId,
          orderId,
          order.referenceCode,
        ),
      ]);
    }

    return successResponse('Offer rejected', { orderId });
  }

  async cancelOrder(
    orderId: string,
    auth: ITokenPayload,
    payload: CancelOrderDTO,
  ): Promise<IResponse> {
    if (!auth.businessId) {
      throw new ForbiddenException('Business context is required');
    }

    const NON_CANCELLABLE = new Set([
      OrderStatus.EN_ROUTE_PICKUP,
      OrderStatus.PICKED_UP,
      OrderStatus.IN_TRANSIT,
      OrderStatus.ARRIVED_AT_DELIVERY,
      OrderStatus.COMPLETED,
      OrderStatus.CANCELLED,
      OrderStatus.DISPUTED,
    ]);

    const order = await this.orderDb.findOrderById({
      orderId,
      businessId: auth.businessId,
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (NON_CANCELLABLE.has(order.status)) {
      throw new BadRequestException(
        `Order cannot be cancelled once it is in '${order.status}' status`,
      );
    }

    const result = await this.orderDb.cancelOrder({
      orderId,
      businessId: auth.businessId,
      cancelledBy: CancelledBy.BUSINESS,
      cancellationReason: payload.reason,
    });

    if (!result) {
      throw new NotFoundException('Order not found');
    }

    if (!result.cancelled) {
      throw new BadRequestException(
        `Order cannot be cancelled in its current state`,
      );
    }

    const sideEffects: Promise<void>[] = [];

    // Escrow reversal + customer email when payment was already held
    const escrowStatuses = new Set([
      OrderStatus.CONFIRMED,
      OrderStatus.OFFER_PENDING,
      OrderStatus.ASSIGNED,
    ]);
    if (
      escrowStatuses.has(result.previousStatus) &&
      result.paymentStatus === PaymentStatus.HELD
    ) {
      await this.orderDb.updateOrderPaymentStatus(orderId, PaymentStatus.REFUNDED);
      sideEffects.push(
        this.orderPaymentService.refundEscrowForCancellation({
          id: orderId,
          businessId: auth.businessId,
          totalAmount: result.totalAmount,
          referenceCode: result.referenceCode,
          parties: result.parties,
          business: result.business,
        }),
      );
    } else if (result.parties?.guestEmail) {
      // No payment was held — still notify the customer the order was cancelled
      sideEffects.push(
        this.paymentEmailQueue.enqueueOrderStatusEmail({
          status: OrderStatus.CANCELLED,
          referenceCode: result.referenceCode,
          senderEmail: result.parties.guestEmail,
          senderName: result.parties.guestFullName ?? 'Customer',
          businessName: result.business?.businessName ?? 'Business',
          amount: result.totalAmount ?? 0,
          wasRefunded: false,
          reason: payload.reason,
        }),
      );
    }

    // Notify displaced rider if one was assigned
    const riderAssignedStatuses = new Set([
      OrderStatus.OFFER_PENDING,
      OrderStatus.ASSIGNED,
    ]);
    if (result.riderId && riderAssignedStatuses.has(result.previousStatus)) {
      const rider = await this.riderDb.findRiderById(auth.businessId, result.riderId);
      if (rider?.authId) {
        sideEffects.push(
          this.notificationService.notifyRiderOrderUnassigned(
            rider.authId,
            orderId,
          ),
        );
      }
    }

    await Promise.allSettled(sideEffects);

    return successResponse('Order cancelled successfully', {
      orderId,
      referenceCode: result.referenceCode,
      previousStatus: result.previousStatus,
      refundInitiated: result.paymentStatus === PaymentStatus.HELD,
    });
  }

  async processPaymentSuccess(
    paymentReference: string,
    webhookPayload: Record<string, any>,
  ): Promise<IResponse> {
    return this.orderPaymentService.processPaymentSuccess(
      paymentReference,
      webhookPayload,
    );
  }

  async processPaymentFailed(
    paymentReference: string,
    webhookPayload: Record<string, any>,
  ): Promise<IResponse> {
    return this.orderPaymentService.processPaymentFailed(
      paymentReference,
      webhookPayload,
    );
  }

  async getMyPendingOffer(auth: ITokenPayload): Promise<IResponse> {
    if (!auth.riderId) {
      throw new ForbiddenException('Rider context is required');
    }

    const offer = await this.orderDb.findPendingOfferForRider(auth.riderId);

    return successResponse(
      offer ? 'Pending offer found' : 'No pending offer',
      offer ?? null,
    );
  }

  async trackOrder(referenceCode: string): Promise<IResponse> {
    const order = await this.orderDb.findOrderByReferenceCode(referenceCode);

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const t = order.tracking;
    const allEvents: Array<{ event: string; label: string; timestamp: Date | null | undefined }> = [
      { event: 'order_placed', label: 'Order Placed', timestamp: order.createdAt },
      { event: 'invoice_sent', label: 'Invoice Sent', timestamp: order.invoiceSentAt },
      { event: 'payment_confirmed', label: 'Payment Confirmed', timestamp: order.paidAt },
      { event: 'rider_assigned', label: 'Rider Assigned', timestamp: t?.assignedAt },
      { event: 'en_route_pickup', label: 'Rider En Route to Pickup', timestamp: t?.enRoutePickupAt },
      { event: 'picked_up', label: 'Package Picked Up', timestamp: t?.pickedUpAt },
      { event: 'in_transit', label: 'In Transit', timestamp: t?.inTransitAt },
      { event: 'arrived_at_delivery', label: 'Arrived at Delivery Location', timestamp: t?.arrivedAtDeliveryAt },
      { event: 'completed', label: 'Delivery Confirmed', timestamp: t?.completedAt },
      { event: 'cancelled', label: 'Order Cancelled', timestamp: t?.cancelledAt },
    ];

    const timeline = allEvents
      .filter((e): e is { event: string; label: string; timestamp: Date } => !!e.timestamp)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return successResponse('Order tracked successfully', {
      referenceCode: order.referenceCode,
      status: order.status,
      business: order.business?.businessName
        ? { name: order.business.businessName }
        : undefined,
      pickup: order.locations
        ? {
            address: order.locations.pickupAddress,
            city: order.locations.pickupCity,
            state: order.locations.pickupState,
          }
        : undefined,
      delivery: order.locations
        ? { address: order.locations.deliveryAddress }
        : undefined,
      cancellationReason: t?.cancellationReason ?? order.cancellationReason ?? null,
      timeline,
    });
  }

  async resendTrackingLink(
    referenceCode: string,
    payload: ResendTrackingDTO,
  ): Promise<IResponse> {
    const order = await this.orderDb.findOrderWithPartiesByReferenceCode(referenceCode);

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const guestEmail = order.parties?.guestEmail;
    if (guestEmail?.toLowerCase() === payload.email.toLowerCase()) {
      const customerName = order.parties?.guestFullName ?? 'Customer';
      this.emailService
        .sendTrackingEmail({ to: guestEmail, customerName, referenceCode })
        .catch((err) =>
          this.logger.warn(
            `Failed to resend tracking email for order ${referenceCode}`,
            err,
          ),
        );
    }

    return successResponse(
      'If your email matches this order, a tracking link has been sent to your inbox.',
      null,
    );
  }

  async updateRiderOrderStatus(
    orderId: string,
    riderId: string,
    status: OrderStatus,
  ): Promise<IResponse> {
    let updated: boolean;
    try {
      updated = await this.orderDb.updateRiderOrderStatus({
        orderId,
        riderId,
        status,
      });
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }

    if (!updated) {
      throw new NotFoundException('Order not found');
    }

    // Fire-and-forget: email sender/recipient based on new status
    this.orderDb.findOrderById({ orderId })
      .then((order) => {
        if (!order?.parties) return;
        return this.paymentEmailQueue.enqueueOrderStatusEmail({
          status,
          referenceCode: order.referenceCode,
          senderEmail: order.parties.guestEmail,
          senderName: order.parties.guestFullName,
          recipientEmail: order.parties.recipientEmail,
          recipientName: order.parties.recipientFullName,
        });
      })
      .catch((err) =>
        this.logger.warn(
          `Failed to queue status emails for order ${orderId} (${status})`,
          err,
        ),
      );

    return successResponse('Order status updated successfully', {
      orderId,
      status,
    });
  }

  async validateDeliveryPin(
    orderId: string,
    pin: string,
    auth: ITokenPayload,
  ): Promise<IResponse> {
    if (!auth.riderId) {
      throw new ForbiddenException('Rider context is required');
    }

    const result = await this.orderDb.findOrderDeliveryPin(
      orderId,
      auth.riderId,
    );

    if (!result) {
      throw new NotFoundException('Order not found');
    }

    if (!result.deliveryPin) {
      throw new BadRequestException(
        'Delivery pin has not been generated for this order',
      );
    }

    if (result.status === OrderStatus.COMPLETED) {
      throw new BadRequestException('Order has already been completed');
    }

    if (result.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Order has been cancelled');
    }

    if (result.paymentStatus !== PaymentStatus.HELD) {
      throw new BadRequestException("Payment hasn't been made yet");
    }

    const isValid = result.deliveryPin === pin;

    if (isValid) {
      await this.orderDb.completeOrder(result.id);
      await this.orderPaymentService.settleEscrow(result);

      // Fire-and-forget: notify sender and recipient that delivery is complete
      this.orderDb.findOrderById({ orderId })
        .then((order) => {
          if (!order?.parties) return;
          return this.paymentEmailQueue.enqueueOrderStatusEmail({
            status: OrderStatus.COMPLETED,
            referenceCode: order.referenceCode,
            senderEmail: order.parties.guestEmail,
            senderName: order.parties.guestFullName,
            recipientEmail: order.parties.recipientEmail,
            recipientName: order.parties.recipientFullName,
          });
        })
        .catch((err) =>
          this.logger.warn(
            `Failed to queue completion emails for order ${orderId}`,
            err,
          ),
        );
    }

    return successResponse(
      isValid ? 'Delivery confirmed successfully' : 'Invalid delivery pin',
      { valid: isValid },
    );
  }

  async resendInvoice(orderId: string, auth: ITokenPayload): Promise<IResponse> {
    if (!auth.businessId) {
      throw new ForbiddenException('Business context is required');
    }

    const order = await this.orderDb.findOrderById({
      orderId,
      businessId: auth.businessId,
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== OrderStatus.INVOICED) {
      throw new BadRequestException(
        'Invoice can only be resent for orders in INVOICED status',
      );
    }

    const customerEmail = order.parties?.guestEmail;
    if (!customerEmail) {
      throw new BadRequestException('Customer email is missing from this order');
    }

    const paymentReference = this.helpers.generateTxReference();

    const checkoutOrder = await this.nombaService.createCheckoutOrder({
      amount: Number(order.totalAmount),
      orderReference: paymentReference,
      customerEmail,
    });

    await this.orderDb.refreshOrderPaymentLink({
      orderId,
      businessId: auth.businessId,
      paymentReference,
      paymentLink: checkoutOrder.checkoutLink,
    });

    await this.paymentEmailQueue.enqueueInvoiceEmail({
      customerEmail,
      customerName: order.parties?.guestFullName ?? 'Customer',
      businessName: order.business?.businessName ?? 'Business',
      referenceCode: order.referenceCode,
      amount: Number(order.totalAmount),
      paymentLink: checkoutOrder.checkoutLink,
      breakdown: order.priceBreakdown ?? undefined,
    });

    return successResponse('Invoice resent successfully', {
      orderId,
      paymentLink: checkoutOrder.checkoutLink,
    });
  }

  async getOrderById(orderId: string, auth: ITokenPayload): Promise<IResponse> {
    const findOpts: { orderId: string; businessId?: string; riderId?: string } =
      { orderId };

    if (auth.userType === UserType.BUSINESS) {
      if (!auth.businessId) {
        throw new ForbiddenException('Business context is required');
      }
      findOpts.businessId = auth.businessId;
    } else if (auth.userType === UserType.RIDER) {
      findOpts.riderId = auth.riderId;
    }

    const order = await this.orderDb.findOrderById(findOpts);

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return successResponse('Order fetched successfully', order);
  }

  async sendInvoice(
    orderId: string,
    payload: SendInvoiceDTO,
    auth: ITokenPayload,
  ): Promise<IResponse> {
    if (!auth.businessId) {
      throw new ForbiddenException('Business context is required');
    }

    const order = await this.orderDb.findOrderById({
      orderId,
      businessId: auth.businessId,
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(
        'Invoice can only be sent for orders in PENDING status',
      );
    }

    const customerEmail = order.parties?.guestEmail;
    const customerName = order.parties?.guestFullName ?? 'Customer';
    const businessName = order.business?.businessName ?? 'Business';

    if (!customerEmail) {
      throw new BadRequestException(
        'Customer email is missing from this order',
      );
    }

    const pickupFee = payload.pickupFee ?? 0;
    const packagingFee = payload.packagingFee ?? 0;

    if (pickupFee > 0 && order.pickupMethod !== PickupMethod.BUSINESS_PICKUP) {
      throw new BadRequestException(
        'Pickup fee only applies when pickupMethod is business_pickup',
      );
    }

    const priceBreakdown = this.orderPricingService.calculateInvoicePricing({
      deliveryFee: payload.deliveryFee,
      pickupFee,
      packagingFee,
    });
    const { serviceFee, totalAmount } = priceBreakdown;

    const paymentReference = this.helpers.generateTxReference();

    const checkoutOrder = await this.nombaService.createCheckoutOrder({
      amount: totalAmount,
      orderReference: paymentReference,
      customerEmail,
    });

    const updatedOrder = await this.orderDb.updateOrderForInvoice({
      orderId,
      businessId: auth.businessId,
      deliveryFee: payload.deliveryFee,
      pickupFee,
      packagingFee,
      serviceFee,
      platformCommission: serviceFee,
      paymentReference,
      paymentLink: checkoutOrder.checkoutLink,
      totalAmount,
      priceBreakdown,
      invoiceSentAt: new Date(),
    });

    await this.paymentEmailQueue.enqueueInvoiceEmail({
      customerEmail,
      customerName,
      businessName,
      referenceCode: order.referenceCode,
      amount: totalAmount,
      paymentLink: checkoutOrder.checkoutLink,
      note: payload.note,
      breakdown: priceBreakdown,
    });

    return successResponse('Invoice sent successfully', updatedOrder);
  }
}
