import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { AppModule } from 'src/app.module';
import { OrderModule } from 'src/api/order/order.module';
import { TransactionsModule } from 'src/api/transactions/transactions.module';
import { NombaService } from 'src/services/nomba.service';
import { PayoutsQueueProcessor } from 'src/api/transactions/queues/payouts.queue.processor';
import { PAYOUTS_QUEUE } from 'src/api/transactions/queues/payouts.queue.constants';

@Module({
  imports: [
    AppModule,
    OrderModule,
    TransactionsModule,
    ConfigModule,
    BullModule.registerQueue({ name: PAYOUTS_QUEUE }),
  ],
  providers: [PayoutsQueueProcessor, NombaService],
})
export class WorkersModule {}
