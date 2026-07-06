import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { TransactionsService } from './transactions.service';
import { TransactionsDb } from './transactions.db';
import { TransactionsController } from './transactions.controller';
import { LedgerJournal } from './schemas/transactions.schema';
import { LedgerEntry } from './schemas/transaction-entries.schema';
import { Payout } from './schemas/payout.schema';
import { Wallet } from 'src/api/wallets/schemas/wallet.schema';
import { Orders } from 'src/api/order/schemas/order.schema';
import { WalletDb } from 'src/api/wallets/wallet.db';
import { Helpers } from 'src/helpers/random-generator';
import { UtilsService } from 'src/helpers/utils.service';
import { NombaService } from 'src/services/nomba.service';
import { AccountModule } from '../account/account.module';
import { NotificationModule } from '../notification/notification.module';
import { RiderModule } from '../rider/rider.module';
import { PayoutsQueueProducer } from './queues/payouts.queue.producer';
import { PAYOUTS_QUEUE } from './queues/payouts.queue.constants';

@Module({
  imports: [
    ConfigModule,
    AccountModule,
    NotificationModule,
    RiderModule,
    TypeOrmModule.forFeature([LedgerJournal, LedgerEntry, Payout, Wallet, Orders]),
    BullModule.registerQueue({ name: PAYOUTS_QUEUE }),
  ],
  providers: [
    TransactionsService,
    TransactionsDb,
    WalletDb,
    Helpers,
    UtilsService,
    NombaService,
    PayoutsQueueProducer,
  ],
  controllers: [TransactionsController],
  exports: [TransactionsService, TransactionsDb, PayoutsQueueProducer],
})
export class TransactionsModule {}
