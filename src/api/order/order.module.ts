import { Module } from '@nestjs/common';
import { OrderService } from './providers/order.service';
import { OrderController } from './order.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Orders } from './schemas/order.schema';
import { OrderParties } from './schemas/order-parties.schema';
import { OrderItem } from './schemas/items.schema';
import { OrderLocations } from './schemas/location.schema';
import { OrderTracking } from './schemas/tracking.schema';
import { BusinessModule } from 'src/api/business/business.module';
import { OrderDb } from './order.db';
import { Helpers } from 'src/helpers/random-generator';
import { UtilsService } from 'src/helpers/utils.service';
import { NombaService } from 'src/services/nomba.service';
import { TransactionsModule } from 'src/api/transactions/transactions.module';
import { Wallet } from 'src/api/wallets/schemas/wallet.schema';
import { WalletDb } from 'src/api/wallets/wallet.db';
import { RiderModule } from 'src/api/rider/rider.module';
import { NotificationModule } from 'src/api/notification/notification.module';
import { AuthenticationDataModule } from 'src/api/authentication/authentication-data.module';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { PAYMENT_EMAIL_QUEUE } from './queues/payment-email.queue.constants';
import { PaymentEmailQueueProducer } from './queues/payment-email.queue.producer';
import { PaymentEmailQueueProcessor } from './queues/payment-email.queue.processor';
import { ORDER_OFFER_QUEUE } from './queues/order-offer.queue.constants';
import { OrderOfferQueueProducer } from './queues/order-offer.queue.producer';
import { OrderOfferQueueProcessor } from './queues/order-offer.queue.processor';
import { EmailService } from 'src/services/email.service';
import { OrderPricingService } from './providers/order-pricing.service';
import { OrderPaymentService } from './providers/order-payment.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Orders,
      OrderParties,
      OrderItem,
      OrderLocations,
      OrderTracking,
      Wallet,
    ]),
    TransactionsModule,
    RiderModule,
    NotificationModule,
    AuthenticationDataModule,
    BusinessModule,
    ConfigModule,
    BullModule.registerQueue({ name: PAYMENT_EMAIL_QUEUE }),
    BullModule.registerQueue({ name: ORDER_OFFER_QUEUE }),
  ],
  providers: [
    OrderService,
    OrderDb,
    Helpers,
    UtilsService,
    NombaService,
    WalletDb,
    PaymentEmailQueueProducer,
    PaymentEmailQueueProcessor,
    OrderOfferQueueProducer,
    OrderOfferQueueProcessor,
    EmailService,
    OrderPricingService,
    OrderPaymentService,
  ],
  exports: [OrderService, OrderDb],
  controllers: [OrderController],
})
export class OrderModule {}
