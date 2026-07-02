import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { RiderService } from './rider.service';
import { RiderController } from './rider.controller';
import { Rider } from './schemas/rider.schema';
import { RiderPerformance } from './schemas/performance.schema';
import { Business } from 'src/api/business/schemas/business.schema';
import { Helpers } from 'src/helpers/random-generator';
import { QUERY_RUNNER_FACTORY } from 'src/constants';
import { QueryRunnerFactory } from 'src/helpers/query-runner.factory';
import { UtilsService } from 'src/helpers/utils.service';
import { ThrottlerModule } from '@nestjs/throttler';
import { RiderLocationThrottlerGuard } from './guards/rider-location-throttler.guard';
import { RiderDb } from './rider.db';
import { RiderLocationHandler } from './rider-location.handler';
import { AuthenticationDataModule } from '../authentication/authentication-data.module';
import { Wallet } from 'src/api/wallets/schemas/wallet.schema';
import { ReviewsDb } from 'src/api/reviews/reviews.db';
import { Review } from 'src/api/reviews/schemas/review.schema';

@Module({
  imports: [
    ConfigModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 1000,
      },
    ]),
    AuthenticationDataModule,
    TypeOrmModule.forFeature([Rider, RiderPerformance, Business, Wallet, Review]),
  ],
  providers: [
    RiderService,
    RiderDb,
    ReviewsDb,
    RiderLocationHandler,
    Helpers,
    UtilsService,
    RiderLocationThrottlerGuard,
    {
      provide: QUERY_RUNNER_FACTORY,
      useClass: QueryRunnerFactory,
    },
  ],
  controllers: [RiderController],
  exports: [RiderDb],
})
export class RiderModule {}
