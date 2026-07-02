import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletsService } from './wallets.service';
import { WalletsController } from './wallets.controller';
import { Wallet } from './schemas/wallet.schema';
import { Business } from 'src/api/business/schemas/business.schema';
import { WalletDb } from './wallet.db';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([Wallet, Business])],
  providers: [WalletsService, WalletDb],
  controllers: [WalletsController],
  exports: [WalletsService, TypeOrmModule],
})
export class WalletsModule {}
