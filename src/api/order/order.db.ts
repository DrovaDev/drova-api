import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Orders } from './schemas/order.schema';
import { OrderItem } from './schemas/items.schema';
import { OrderParties } from './schemas/order-parties.schema';
import { OrderLocations } from './schemas/location.schema';
import { OrderTracking } from './schemas/tracking.schema';
import {
  OrderStatus,
  PaymentStatus,
  PickupMethod,
  DeliveryPriority,
  CancelledBy,
} from 'src/constants';

@Injectable()
export class OrderDb {
  constructor(
    @InjectRepository(Orders)
    private readonly orderModel: Repository<Orders>,
    @InjectRepository(OrderParties)
    private readonly orderPartiesModel: Repository<OrderParties>,
  ) {}

  async offerOrderToRider(opts: {
    orderId: string;
    riderId: string;
    offerExpiresAt: Date;
  }): Promise<void> {
    await this.orderModel.update(opts.orderId, {
      riderId: opts.riderId,
      status: OrderStatus.OFFER_PENDING,
      offerExpiresAt: opts.offerExpiresAt,
    });
  }

  async acceptOrderOffer(opts: {
    orderId: string;
    riderId: string;
  }): Promise<boolean> {
    const assignedAt = new Date();

    return await this.orderModel.manager.transaction(async (manager) => {
      const ordersRepo = manager.getRepository(Orders);

      const result = await ordersRepo
        .createQueryBuilder()
        .update(Orders)
        .set({ status: OrderStatus.ASSIGNED, offerExpiresAt: () => 'NULL' })
        .where('id = :orderId AND "riderId" = :riderId AND status = :status', {
          orderId: opts.orderId,
          riderId: opts.riderId,
          status: OrderStatus.OFFER_PENDING,
        })
        .execute();

      if (!result.affected) return false;

      const trackingRepo = manager.getRepository(OrderTracking);
      const trackingUpdate = await trackingRepo.update(
        { orderId: opts.orderId },
        { assignedAt },
      );

      if (!trackingUpdate.affected) {
        await trackingRepo.save(
          trackingRepo.create({ orderId: opts.orderId, assignedAt }),
        );
      }

      return true;
    });
  }

  async expireOrderOffer(opts: {
    orderId: string;
    riderId: string;
  }): Promise<boolean> {
    const result = await this.orderModel
      .createQueryBuilder()
      .update(Orders)
      .set({
        status: OrderStatus.CONFIRMED,
        riderId: () => 'NULL',
        offerExpiresAt: () => 'NULL',
      })
      .where('id = :orderId AND "riderId" = :riderId AND status = :status', {
        orderId: opts.orderId,
        riderId: opts.riderId,
        status: OrderStatus.OFFER_PENDING,
      })
      .execute();

    return (result.affected ?? 0) > 0;
  }

  async assignOrderToRider(opts: {
    orderId: string;
    riderId: string;
  }): Promise<void> {
    const assignedAt = new Date();

    await this.orderModel.manager.transaction(async (manager) => {
      await manager.getRepository(Orders).update(opts.orderId, {
        riderId: opts.riderId,
        status: OrderStatus.ASSIGNED,
      });

      const trackingRepo = manager.getRepository(OrderTracking);
      const trackingUpdate = await trackingRepo.update(
        { orderId: opts.orderId },
        { assignedAt },
      );

      if (!trackingUpdate.affected) {
        await trackingRepo.save(
          trackingRepo.create({
            orderId: opts.orderId,
            assignedAt,
          }),
        );
      }
    });
  }

  async createOrderTransaction(opts: {
    order: Partial<Orders>;
    items: Partial<OrderItem>[];
    parties: Partial<OrderParties>;
    locations: Partial<OrderLocations>;
  }): Promise<Orders> {
    return await this.orderModel.manager.transaction(async (manager) => {
      const savedOrder = await manager.save(Orders, opts.order as Orders);

      const itemEntities = opts.items.map((item) => ({
        ...item,
        orderId: savedOrder.id,
      }));
      await manager.save(OrderItem, itemEntities as OrderItem[]);

      await manager.save(OrderParties, {
        ...opts.parties,
        orderId: savedOrder.id,
      } as OrderParties);

      await manager.save(OrderLocations, {
        ...opts.locations,
        orderId: savedOrder.id,
      } as OrderLocations);

      await manager.save(OrderTracking, {
        orderId: savedOrder.id,
      } as OrderTracking);

      return manager.findOne(Orders, {
        where: { id: savedOrder.id },
        relations: ['items', 'parties', 'locations', 'tracking'],
      }) as Promise<Orders>;
    });
  }

  async updateOrderForInvoice(opts: {
    orderId: string;
    businessId: string;
    deliveryFee: number;
    pickupFee: number;
    packagingFee: number;
    serviceFee: number;
    platformCommission: number;
    paymentReference: string;
    paymentLink: string;
    totalAmount: number;
    priceBreakdown?: Record<string, any>;
    invoiceSentAt: Date;
  }): Promise<Orders | null> {
    const order = await this.orderModel.findOne({
      where: { id: opts.orderId, businessId: opts.businessId },
    });

    if (!order) return null;

    await this.orderModel.update(opts.orderId, {
      deliveryFee: opts.deliveryFee,
      pickupFee: opts.pickupFee,
      packagingFee: opts.packagingFee,
      serviceFee: opts.serviceFee,
      platformCommission: opts.platformCommission,
      paymentReference: opts.paymentReference,
      paymentLink: opts.paymentLink,
      totalAmount: opts.totalAmount,
      priceBreakdown: opts.priceBreakdown,
      invoiceSentAt: opts.invoiceSentAt,
      status: OrderStatus.INVOICED,
    });

    return this.orderModel.findOne({
      where: { id: opts.orderId },
      relations: ['parties', 'locations', 'items', 'business'],
    });
  }

  async refreshOrderPaymentLink(opts: {
    orderId: string;
    businessId: string;
    paymentReference: string;
    paymentLink: string;
  }): Promise<Orders | null> {
    const order = await this.orderModel.findOne({
      where: {
        id: opts.orderId,
        businessId: opts.businessId,
        status: OrderStatus.INVOICED,
        isDeleted: false,
      },
      relations: ['parties', 'locations', 'items', 'business'],
    });

    if (!order) return null;

    await this.orderModel.update(opts.orderId, {
      paymentReference: opts.paymentReference,
      paymentLink: opts.paymentLink,
      invoiceSentAt: new Date(),
    });

    return {
      ...order,
      paymentReference: opts.paymentReference,
      paymentLink: opts.paymentLink,
    };
  }

  async listBusinessOrders(opts: {
    businessId: string;
    search?: string;
    status?: OrderStatus | 'quotation' | 'all';
    paymentStatus?: PaymentStatus;
    pickupMethod?: PickupMethod;
    deliveryPriority?: DeliveryPriority;
    startDate?: string;
    endDate?: string;
    offset: number;
    limit: number;
    sortBy: string;
    sortOrder: 'ASC' | 'DESC';
  }): Promise<{ orders: Orders[]; count: number }> {
    const qb = this.orderModel
      .createQueryBuilder('orders')
      .where('orders.businessId = :businessId', {
        businessId: opts.businessId,
      })
      .andWhere('orders.isDeleted = false');

    if (opts.search) {
      const s = `%${String(opts.search).trim().toLowerCase()}%`;
      qb.andWhere('(LOWER(orders.referenceCode) LIKE :s)', { s });
    }

    if (opts.status) {
      if (opts.status === 'quotation') {
        qb.andWhere('orders.status IN (:...statuses)', {
          statuses: [OrderStatus.PENDING, OrderStatus.INVOICED],
        });
      } else if (opts.status === 'all') {
        qb.andWhere('orders.status NOT IN (:...statuses)', {
          statuses: [OrderStatus.PENDING, OrderStatus.INVOICED],
        });
      } else {
        qb.andWhere('orders.status = :status', { status: opts.status });
      }
    }

    if (opts.paymentStatus) {
      qb.andWhere('orders.paymentStatus = :paymentStatus', {
        paymentStatus: opts.paymentStatus,
      });
    }
    if (opts.pickupMethod) {
      qb.andWhere('orders.pickupMethod = :pickupMethod', {
        pickupMethod: opts.pickupMethod,
      });
    }

    if (opts.deliveryPriority) {
      qb.andWhere('orders.deliveryPriority = :deliveryPriority', {
        deliveryPriority: opts.deliveryPriority,
      });
    }

    if (opts.startDate && opts.endDate) {
      qb.andWhere(
        'orders.createdAt >= :startDate AND orders.createdAt <= :endDate',
        { startDate: opts.startDate, endDate: opts.endDate },
      );
    } else if (opts.startDate) {
      qb.andWhere('orders.createdAt >= :startDate', {
        startDate: opts.startDate,
      });
    } else if (opts.endDate) {
      qb.andWhere('orders.createdAt <= :endDate', {
        endDate: opts.endDate,
      });
    }

    const count = await qb.getCount();

    qb.orderBy(`orders.${opts.sortBy}`, opts.sortOrder);
    qb.skip(opts.offset).take(opts.limit);

    qb.leftJoinAndSelect('orders.items', 'items')
      .leftJoinAndSelect('orders.parties', 'parties')
      .leftJoinAndSelect('orders.locations', 'locations')
      .leftJoinAndSelect('orders.tracking', 'tracking')
      .leftJoinAndSelect('orders.rider', 'rider');

    const orders = await qb.getMany();

    return { orders, count };
  }

  async listRiderOrders(opts: {
    riderId: string;
    search?: string;
    status?: OrderStatus;
    paymentStatus?: PaymentStatus;
    startDate?: string;
    endDate?: string;
    offset: number;
    limit: number;
    sortBy: string;
    sortOrder: 'ASC' | 'DESC';
  }): Promise<{ orders: Orders[]; count: number }> {
    const qb = this.orderModel
      .createQueryBuilder('orders')
      .where('orders.riderId = :riderId', { riderId: opts.riderId })
      .andWhere('orders.isDeleted = false');

    if (opts.search) {
      const s = `%${String(opts.search).trim().toLowerCase()}%`;
      qb.andWhere('(LOWER(orders.referenceCode) LIKE :s)', { s });
    }

    if (opts.status) {
      qb.andWhere('orders.status = :status', { status: opts.status });
    }

    if (opts.paymentStatus) {
      qb.andWhere('orders.paymentStatus = :paymentStatus', {
        paymentStatus: opts.paymentStatus,
      });
    }

    if (opts.startDate && opts.endDate) {
      qb.andWhere(
        'orders.createdAt >= :startDate AND orders.createdAt <= :endDate',
        { startDate: opts.startDate, endDate: opts.endDate },
      );
    } else if (opts.startDate) {
      qb.andWhere('orders.createdAt >= :startDate', {
        startDate: opts.startDate,
      });
    } else if (opts.endDate) {
      qb.andWhere('orders.createdAt <= :endDate', {
        endDate: opts.endDate,
      });
    }

    const count = await qb.getCount();

    qb.orderBy(`orders.${opts.sortBy}`, opts.sortOrder);
    qb.skip(opts.offset).take(opts.limit);

    qb.leftJoinAndSelect('orders.items', 'items')
      .leftJoinAndSelect('orders.parties', 'parties')
      .leftJoinAndSelect('orders.locations', 'locations')
      .leftJoinAndSelect('orders.tracking', 'tracking')
      .leftJoinAndSelect('orders.business', 'business');

    const orders = await qb.getMany();

    return { orders, count };
  }

  async findOrderById(opts: {
    orderId: string;
    businessId?: string;
    riderId?: string;
  }): Promise<Orders | null> {
    const where: Record<string, any> = {
      id: opts.orderId,
      isDeleted: false,
    };

    if (opts.businessId) {
      where.businessId = opts.businessId;
    }

    if (opts.riderId) {
      where.riderId = opts.riderId;
    }

    return this.orderModel.findOne({
      where,
      relations: [
        'items',
        'parties',
        'locations',
        'tracking',
        'rider',
        'business',
      ],
    });
  }

  async findPendingOfferForRider(riderId: string): Promise<Orders | null> {
    return this.orderModel.findOne({
      where: { riderId, status: OrderStatus.OFFER_PENDING, isDeleted: false },
      relations: ['items', 'parties', 'locations', 'business'],
    });
  }

  async findOrderByReferenceCode(
    referenceCode: string,
  ): Promise<Orders | null> {
    return this.orderModel.findOne({
      where: { referenceCode, isDeleted: false },
      relations: ['items', 'locations', 'tracking', 'business', 'parties'],
    });
  }

  async findOrderWithPartiesByReferenceCode(
    referenceCode: string,
  ): Promise<Orders | null> {
    return this.orderModel.findOne({
      where: { referenceCode, isDeleted: false },
      relations: ['parties', 'rider'],
    });
  }

  async findOrderPartiesByOrderId(
    orderId: string,
  ): Promise<OrderParties | null> {
    return this.orderPartiesModel.findOne({ where: { orderId } });
  }

  async findOrderByPaymentReference(
    paymentReference: string,
  ): Promise<Orders | null> {
    return this.orderModel.findOne({
      where: { paymentReference, isDeleted: false },
      relations: ['business', 'parties'],
    });
  }

  async confirmManualOrder(opts: {
    orderId: string;
    businessId: string;
    deliveryFee: number;
    pickupFee: number;
    packagingFee: number;
    serviceFee: number;
    platformCommission: number;
    totalAmount: number;
    priceBreakdown: Record<string, any>;
    deliveryPin: string;
    paymentMethod: string;
  }): Promise<Orders | null> {
    await this.orderModel.update(opts.orderId, {
      deliveryFee: opts.deliveryFee,
      pickupFee: opts.pickupFee,
      packagingFee: opts.packagingFee,
      serviceFee: opts.serviceFee,
      platformCommission: opts.platformCommission,
      totalAmount: opts.totalAmount,
      priceBreakdown: opts.priceBreakdown,
      deliveryPin: opts.deliveryPin,
      status: OrderStatus.CONFIRMED,
      paymentStatus: PaymentStatus.RELEASED,
      paidAt: new Date(),
    });

    return this.orderModel.findOne({
      where: { id: opts.orderId },
      relations: ['items', 'parties', 'locations', 'tracking'],
    });
  }

  async updateOrderPaymentStatus(
    orderId: string,
    paymentStatus: PaymentStatus,
    updates?: {
      paidAt?: Date;
      deliveryPin?: string;
      escrowHeldAt?: Date;
      escrowReleasedAt?: Date;
      webhookPayload?: Record<string, any>;
    },
  ): Promise<void> {
    await this.orderModel.update(orderId, {
      paymentStatus,
      ...updates,
    });
  }

  async updateOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
    await this.orderModel.update(orderId, { status });
  }

  async findOrderDeliveryPin(
    orderId: string,
    riderId: string,
  ): Promise<{
    id: string;
    deliveryPin: string | null;
    status: string;
    businessId: string;
    totalAmount: number;
    platformCommission: number;
    paymentStatus: string;
  } | null> {
    const order = await this.orderModel.findOne({
      where: { id: orderId, riderId, isDeleted: false },
      select: [
        'id',
        'deliveryPin',
        'status',
        'businessId',
        'totalAmount',
        'platformCommission',
        'paymentStatus',
      ],
    });
    if (!order) return null;
    return {
      id: order.id,
      deliveryPin: order.deliveryPin ?? null,
      status: order.status,
      businessId: order.businessId,
      totalAmount: Number(order.totalAmount),
      platformCommission: Number(order.platformCommission),
      paymentStatus: order.paymentStatus,
    };
  }

  async updateRiderOrderStatus(opts: {
    orderId: string;
    riderId: string;
    status: OrderStatus;
  }): Promise<boolean> {
    const { orderId, riderId, status } = opts;

    const allowedTransitions: Partial<Record<OrderStatus, OrderStatus>> = {
      [OrderStatus.ASSIGNED]: OrderStatus.EN_ROUTE_PICKUP,
      [OrderStatus.EN_ROUTE_PICKUP]: OrderStatus.PICKED_UP,
      [OrderStatus.PICKED_UP]: OrderStatus.IN_TRANSIT,
      [OrderStatus.IN_TRANSIT]: OrderStatus.ARRIVED_AT_DELIVERY,
    };

    const trackingField: Partial<Record<OrderStatus, keyof OrderTracking>> = {
      [OrderStatus.EN_ROUTE_PICKUP]: 'enRoutePickupAt',
      [OrderStatus.PICKED_UP]: 'pickedUpAt',
      [OrderStatus.IN_TRANSIT]: 'inTransitAt',
      [OrderStatus.ARRIVED_AT_DELIVERY]: 'arrivedAtDeliveryAt',
    };

    const order = await this.orderModel.findOne({
      where: { id: orderId, riderId, isDeleted: false },
      select: ['id', 'status'],
    });

    if (!order) return false;

    if (allowedTransitions[order.status] !== status) {
      throw new Error(
        `Cannot transition order from '${order.status}' to '${status}'`,
      );
    }

    const now = new Date();
    const field = trackingField[status]!;

    await this.orderModel.manager.transaction(async (manager) => {
      await manager.getRepository(Orders).update(orderId, { status });

      const trackingRepo = manager.getRepository(OrderTracking);
      const updated = await trackingRepo.update({ orderId }, { [field]: now });

      if (!updated.affected) {
        await trackingRepo.save(trackingRepo.create({ orderId, [field]: now }));
      }
    });

    return true;
  }

  async cancelOrder(opts: {
    orderId: string;
    businessId: string;
    cancelledBy: CancelledBy;
    cancellationReason?: string;
  }): Promise<{
    cancelled: boolean;
    previousStatus: OrderStatus;
    paymentStatus: PaymentStatus;
    riderId?: string;
    referenceCode: string;
    totalAmount?: number;
    parties?: { guestEmail?: string; guestFullName?: string };
    business?: { authId?: string; businessName?: string };
  } | null> {
    const CANCELLABLE = [
      OrderStatus.PENDING,
      OrderStatus.INVOICED,
      OrderStatus.CONFIRMED,
      OrderStatus.OFFER_PENDING,
      OrderStatus.ASSIGNED,
    ];

    const order = await this.orderModel.findOne({
      where: {
        id: opts.orderId,
        businessId: opts.businessId,
        isDeleted: false,
      },
      relations: ['parties', 'business'],
    });

    if (!order) return null;
    if (!CANCELLABLE.includes(order.status)) {
      return {
        cancelled: false,
        previousStatus: order.status,
        paymentStatus: order.paymentStatus,
        riderId: order.riderId,
        referenceCode: order.referenceCode,
        totalAmount: order.totalAmount,
        parties: order.parties,
        business: order.business,
      };
    }

    await this.orderModel.update(opts.orderId, {
      status: OrderStatus.CANCELLED,
      cancelledBy: opts.cancelledBy,
      cancelledAt: new Date(),
      cancellationReason: opts.cancellationReason,
    });

    return {
      cancelled: true,
      previousStatus: order.status,
      paymentStatus: order.paymentStatus,
      riderId: order.riderId,
      referenceCode: order.referenceCode,
      totalAmount: order.totalAmount,
      parties: order.parties,
      business: order.business,
    };
  }

  async completeOrder(orderId: string): Promise<void> {
    const now = new Date();

    await this.orderModel.manager.transaction(async (manager) => {
      await manager.getRepository(Orders).update(orderId, {
        status: OrderStatus.COMPLETED,
      });

      const trackingRepo = manager.getRepository(OrderTracking);
      const updated = await trackingRepo.update(
        { orderId },
        { completedAt: now, deliveredAt: now },
      );

      if (!updated.affected) {
        await trackingRepo.save(
          trackingRepo.create({ orderId, completedAt: now, deliveredAt: now }),
        );
      }
    });
  }
}
