import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserType, WalletOwnerType } from 'src/constants';
import { Auth, Roles } from 'src/interfaces/customs.decorator';
import type { ITokenPayload } from 'src/interfaces/token.interface';
import { AuthGuard } from '../authentication/guards/authentication.guard';
import { RolesGuard } from '../authentication/guards/roles.guard';
import { WalletsService } from './wallets.service';
import { SetWithdrawalPinDTO, UpdateWithdrawalPinDTO } from './dtos/wallet.dto';

@ApiTags('wallets')
@Controller('wallets')
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.BUSINESS, UserType.RIDER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get wallet (business/rider)' })
  async getWallet(@Auth() auth: ITokenPayload) {
    const ownerType =
      auth.userType === UserType.BUSINESS
        ? WalletOwnerType.BUSINESS
        : WalletOwnerType.RIDER;
    if (ownerType === WalletOwnerType.BUSINESS) {
      if (!auth.businessId) {
        throw new ForbiddenException('Business ID is required for business users');
      }
      return await this.walletsService.getWalletByOwner(ownerType, auth.businessId);
    }
    if (!auth.riderId) {
      throw new ForbiddenException('Rider ID is required for rider users');
    }
    return await this.walletsService.getWalletByOwner(ownerType, auth.riderId);
  }

  @Post('withdrawal-pin')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.BUSINESS, UserType.RIDER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Set a withdrawal PIN for the wallet' })
  async setWithdrawalPin(
    @Auth() auth: ITokenPayload,
    @Body() dto: SetWithdrawalPinDTO,
  ) {
    return await this.walletsService.setWithdrawalPin(auth, dto);
  }

  @Patch('withdrawal-pin')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.BUSINESS, UserType.RIDER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update the withdrawal PIN for the wallet' })
  async updateWithdrawalPin(
    @Auth() auth: ITokenPayload,
    @Body() dto: UpdateWithdrawalPinDTO,
  ) {
    return await this.walletsService.updateWithdrawalPin(auth, dto);
  }
}
