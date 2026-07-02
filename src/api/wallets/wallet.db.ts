import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Business } from 'src/api/business/schemas/business.schema';
import { Rider } from 'src/api/rider/schemas/rider.schema';
import { Wallet } from './schemas/wallet.schema';
import { WalletOwnerType, WalletStatus } from 'src/constants';

@Injectable()
export class WalletDb {
  constructor(
    @InjectRepository(Wallet)
    private readonly walletModel: Repository<Wallet>,
  ) {}

  findWalletByOwner(
    ownerType: WalletOwnerType,
    ownerId: string,
  ): Promise<Wallet | null> {
    return this.walletModel.findOne({
      where: {
        ownerType,
        ownerId,
        status: WalletStatus.READY,
      },
    });
  }

  findSystemWallet(
    ownerType: WalletOwnerType.CLEARING | WalletOwnerType.PLATFORM,
  ): Promise<Wallet | null> {
    return this.walletModel.findOne({
      where: { ownerType, status: WalletStatus.READY },
    });
  }

  findWalletById(walletId: string): Promise<Wallet | null> {
    return this.walletModel.findOne({
      where: {
        id: walletId,
        status: WalletStatus.READY,
      },
    });
  }

  findWalletWithOwnerById(walletId: string): Promise<{
    wallet: Wallet;
    owner: Business | Rider;
  } | null> {
    return this.walletModel
      .createQueryBuilder('wallet')
      .where('wallet.id = :walletId', { walletId })
      .andWhere('wallet.status = :status', { status: WalletStatus.READY })
      .leftJoinAndMapOne(
        'wallet.businessOwner',
        Business,
        'business',
        'business.id = wallet.ownerId AND wallet.ownerType = :businessOwnerType',
        { businessOwnerType: WalletOwnerType.BUSINESS },
      )
      .leftJoinAndMapOne(
        'wallet.riderOwner',
        Rider,
        'rider',
        'rider.id = wallet.ownerId AND wallet.ownerType = :riderOwnerType',
        { riderOwnerType: WalletOwnerType.RIDER },
      )
      .getOne()
      .then((wallet) => {
        if (!wallet) return null;
        const owner =
          (wallet as any).businessOwner || (wallet as any).riderOwner || null;
        return { wallet, owner };
      });
  }
}
