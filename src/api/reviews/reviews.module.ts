import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { ReviewsDb } from './reviews.db';
import { Review } from './schemas/review.schema';
import { AuthenticationDataModule } from '../authentication/authentication-data.module';
import { OrderModule } from '../order/order.module';
import { UtilsService } from 'src/helpers/utils.service';

@Module({
  imports: [
    AuthenticationDataModule,
    OrderModule,
    TypeOrmModule.forFeature([Review]),
  ],
  providers: [ReviewsService, ReviewsDb, UtilsService],
  controllers: [ReviewsController],
  exports: [ReviewsService],
})
export class ReviewsModule {}
