import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthenticationModule } from './api/authentication/authentication.module';
import { BusinessModule } from './api/business/business.module';
import { RiderModule } from './api/rider/rider.module';
import { WalletsModule } from './api/wallets/wallets.module';
import { WebhooksModule } from './api/webhooks/webhooks.module';
import { QueuesModule } from './queues/queues.module';
import { OrderModule } from './api/order/order.module';
import { TransactionsModule } from './api/transactions/transactions.module';
import { NotificationModule } from './api/notification/notification.module';
import { AccountModule } from './api/account/account.module';
import { ReviewsModule } from './api/reviews/reviews.module';
import { MqttModule } from './mqtt/mqtt.module';

@Module({
  imports: [
    MqttModule,
    AuthenticationModule,
    BusinessModule,
    OrderModule,
    RiderModule,
    WalletsModule,
    TransactionsModule,
    NotificationModule,
    AccountModule,
    ReviewsModule,
    QueuesModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath:
        process.env.NODE_ENV === 'production'
          ? '.prod.env'
          : process.env.NODE_ENV === 'staging'
            ? '.staging.env'
            : '.dev.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST'),
        port: 5432,
        username: configService.get('DB_USERNAME'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('DB_NAME'),
        autoLoadEntities: true,
        synchronize: configService.get('NODE_ENV') === 'development',
        extra: {
          max: 10,
          min: 2,
          keepAlive: true,
          idleTimeoutMillis: 3000, // disable idle timeout
          connectTimeoutMillis: 10000, // 10s timeout for initial connection
          options: '-c timezone=UTC',
        },
        ssl: {
          rejectUnauthorized: false, // Use true in production with proper certificates
        },
      }),
      inject: [ConfigService],
    }),
    WebhooksModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
