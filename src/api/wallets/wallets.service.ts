import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { IResponse } from 'src/interfaces/response.interface';
import { WalletDb } from './wallet.db';
import { UserType, WalletOwnerType } from 'src/constants';
import type { ITokenPayload } from 'src/interfaces/token.interface';
import { SetWithdrawalPinDTO, UpdateWithdrawalPinDTO } from './dtos/wallet.dto';

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

  private resolveWalletOwner(auth: ITokenPayload): { ownerType: WalletOwnerType; ownerId: string } {
    const isRider = auth.userType === UserType.RIDER;
    const ownerType = isRider ? WalletOwnerType.RIDER : WalletOwnerType.BUSINESS;
    const ownerId = isRider ? auth.riderId : auth.businessId;
    if (!ownerId) throw new BadRequestException('Owner context is required');
    return { ownerType, ownerId };
  }

  async setWithdrawalPin(
    auth: ITokenPayload,
    dto: SetWithdrawalPinDTO,
  ): Promise<IResponse> {
    const { ownerType, ownerId } = this.resolveWalletOwner(auth);
    const wallet = await this.walletDb.findWalletByOwner(ownerType, ownerId);
    if (!wallet) throw new NotFoundException('Wallet not found');
    if (wallet.hasWithdrawalPin) {
      throw new BadRequestException(
        'Withdrawal PIN already set. Use the update endpoint to change it.',
      );
    }
    const hashed = await bcrypt.hash(dto.pin, 10);
    await this.walletDb.saveWithdrawalPin(wallet.id, hashed);
    return {
      status: 'success',
      statusCode: 200,
      message: 'Withdrawal PIN set successfully',
      data: null,
    };
  }

  async updateWithdrawalPin(
    auth: ITokenPayload,
    dto: UpdateWithdrawalPinDTO,
  ): Promise<IResponse> {
    const { ownerType, ownerId } = this.resolveWalletOwner(auth);
    const wallet = await this.walletDb.findWalletWithPin(
      (await this.walletDb.findWalletByOwner(ownerType, ownerId))?.id ?? '',
    );
    if (!wallet) throw new NotFoundException('Wallet not found');
    if (!wallet.hasWithdrawalPin || !wallet.withdrawalPin) {
      throw new BadRequestException(
        'No withdrawal PIN set. Use the set endpoint first.',
      );
    }
    const match = await bcrypt.compare(dto.currentPin, wallet.withdrawalPin);
    if (!match) throw new ForbiddenException('Current PIN is incorrect');
    if (dto.currentPin === dto.newPin) {
      throw new BadRequestException('New PIN must differ from the current PIN');
    }
    const hashed = await bcrypt.hash(dto.newPin, 10);
    await this.walletDb.saveWithdrawalPin(wallet.id, hashed);
    return {
      status: 'success',
      statusCode: 200,
      message: 'Withdrawal PIN updated successfully',
      data: null,
    };
  }

  async verifyWithdrawalPin(walletId: string, pin: string): Promise<void> {
    const wallet = await this.walletDb.findWalletWithPin(walletId);
    if (!wallet) throw new NotFoundException('Wallet not found');
    if (!wallet.hasWithdrawalPin || !wallet.withdrawalPin) {
      throw new BadRequestException(
        'Withdrawal PIN not set. Please set a withdrawal PIN before making a withdrawal.',
      );
    }
    const match = await bcrypt.compare(pin, wallet.withdrawalPin);
    if (!match) throw new ForbiddenException('Incorrect withdrawal PIN');
  }
}
