import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WebhooksService } from './webhooks.service';
import { WebhooksController } from './webhooks.controller';
import { OrderModule } from 'src/api/order/order.module';
import { TransactionsModule } from 'src/api/transactions/transactions.module';
import { NombaService } from 'src/services/nomba.service';

@Module({
  imports: [ConfigModule, OrderModule, TransactionsModule],
  providers: [WebhooksService, NombaService],
  controllers: [WebhooksController],
})
export class WebhooksModule {}
