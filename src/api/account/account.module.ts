import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountService } from './account.service';
import { AccountController } from './account.controller';
import { AccountDb } from './account.db';
import { BankAccount } from './schemas/bank-account.schema';
import { NombaService } from 'src/services/nomba.service';
import { AuthenticationDataModule } from '../authentication/authentication-data.module';
import { RiderModule } from '../rider/rider.module';
import { BusinessModule } from '../business/business.module';

@Module({
  imports: [
    ConfigModule,
    AuthenticationDataModule,
    RiderModule,
    BusinessModule,
    TypeOrmModule.forFeature([BankAccount]),
  ],
  providers: [AccountService, AccountDb, NombaService],
  controllers: [AccountController],
  exports: [AccountService, AccountDb],
})
export class AccountModule {}
