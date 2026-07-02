import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { IResponse } from 'src/interfaces/response.interface';
import { WalletDb } from './wallet.db';
import { WalletOwnerType } from 'src/constants';

@Injectable()
export class WalletsService {
  constructor(private readonly walletDb: WalletDb) {}

  async getWalletByOwner(
    ownerType: WalletOwnerType,
    ownerId: string,
  ): Promise<IResponse> {
    const wallet = await this.walletDb.findWalletByOwner(ownerType, ownerId);
    if (!wallet) {
      throw new NotFoundException('Wallet not found for the specified owner');
    }
    return {
      status: 'success',
      statusCode: 200,
      message: 'Wallet retrieved successfully',
      data: wallet,
    };
  }

  async getWalletById(walletId: string): Promise<IResponse> {
    const wallet = await this.walletDb.findWalletById(walletId);
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }
    return {
      status: 'success',
      statusCode: 200,
      message: 'Wallet retrieved successfully',
      data: wallet,
    };
  }
}
