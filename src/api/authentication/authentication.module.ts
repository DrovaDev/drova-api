import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { StringValue } from 'ms';
import { AuthenticationService } from './authentication.service';
import { AuthenticationController } from './authentication.controller';
import { Helpers } from 'src/helpers/random-generator';
import { EmailService } from 'src/services/email.service';
import { AuthenticationDataModule } from './authentication-data.module';
import { RiderModule } from 'src/api/rider/rider.module';
import { BusinessModule } from 'src/api/business/business.module';
import { NotificationModule } from 'src/api/notification/notification.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReviewsDb } from 'src/api/reviews/reviews.db';
import { Review } from 'src/api/reviews/schemas/review.schema';
import { NeuronService } from 'src/services/neuron.service';

@Module({
  imports: [
    AuthenticationDataModule,
    RiderModule,
    BusinessModule,
    NotificationModule,
    ConfigModule,
    TypeOrmModule.forFeature([Review]),
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error('JWT_SECRET is not configured');
        }
        const expiresIn = (configService.get<string>('JWT_EXPIRES_IN') ??
          '7d') as StringValue;
        return {
          secret,
          signOptions: {
            expiresIn,
          },
        };
      },
    }),
  ],
  providers: [AuthenticationService, ReviewsDb, Helpers, EmailService, NeuronService],
  controllers: [AuthenticationController],
  exports: [AuthenticationDataModule],
})
export class AuthenticationModule {}
