import { Controller, ForbiddenException, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UserType, WalletOwnerType } from 'src/constants';
import { Auth, Roles } from 'src/interfaces/customs.decorator';
import type { ITokenPayload } from 'src/interfaces/token.interface';
import { AuthGuard } from '../authentication/guards/authentication.guard';
import { RolesGuard } from '../authentication/guards/roles.guard';
import { WalletsService } from './wallets.service';

@Controller('wallets')
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.BUSINESS, UserType.RIDER)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get wallet (business/rider)',
  })
  async getWallet(@Auth() auth: ITokenPayload) {
    const ownerType =
      auth.userType === UserType.BUSINESS
        ? WalletOwnerType.BUSINESS
        : WalletOwnerType.RIDER;
    if (ownerType === WalletOwnerType.BUSINESS) {
      if (!auth.businessId) {
        throw new ForbiddenException(
          'Business ID is required for business users',
        );
      }
      return await this.walletsService.getWalletByOwner(
        ownerType,
        auth.businessId,
      );
    }

    if (!auth.riderId) {
      throw new ForbiddenException('Rider ID is required for rider users');
    }
    return await this.walletsService.getWalletByOwner(ownerType, auth.riderId);
  }
}
