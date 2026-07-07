import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QUERY_RUNNER_FACTORY } from 'src/constants';
import { QueryRunnerFactory } from 'src/helpers/query-runner.factory';
import { Auth } from 'src/api/authentication/schemas/auth.schema';
import { BusinessService } from './business.service';
import { Business } from './schemas/business.schema';
import { BusinessValidationService } from 'src/services/business-validation.service';
import { BusinessController } from './business.controller';
import { BusinessDb } from './business.db';
import { AuthenticationDataModule } from '../authentication/authentication-data.module';
import { ReviewsModule } from '../reviews/reviews.module';

@Module({
  imports: [
    AuthenticationDataModule,
    ReviewsModule,
    TypeOrmModule.forFeature([Business, Auth]),
  ],
  providers: [
    BusinessService,
    BusinessDb,
    BusinessValidationService,
    {
      provide: QUERY_RUNNER_FACTORY,
      useClass: QueryRunnerFactory,
    },
  ],
  controllers: [BusinessController],
  exports: [BusinessDb],
})
export class BusinessModule {}
