import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth, Roles } from 'src/interfaces/customs.decorator';
import type { ITokenPayload } from 'src/interfaces/token.interface';
import { AuthGuard } from '../authentication/guards/authentication.guard';
import { RolesGuard } from '../authentication/guards/roles.guard';
import { UserType } from 'src/constants';
import { AccountService } from './account.service';
import {
  SavePayoutAccountDTO,
  UpdatePayoutAccountDTO,
  ResolveAccountQueryDTO,
} from './dtos/account.dto';

@Controller('account')
@ApiTags('account')
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Get('banks')
  @ApiOperation({ summary: 'Fetch list of supported banks' })
  async getBanks() {
    return this.accountService.getBanks();
  }

  @Get('banks/resolve')
  @ApiOperation({ summary: 'Resolve account name from account number and bank code' })
  async resolveAccount(@Query() query: ResolveAccountQueryDTO) {
    return this.accountService.resolveAccount(query);
  }

  @Post('rider/payout-account')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.RIDER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Save rider payout bank account (rider only)' })
  async saveRiderPayoutAccount(
    @Auth() auth: ITokenPayload,
    @Body() dto: SavePayoutAccountDTO,
  ) {
    return this.accountService.saveRiderPayoutAccount(auth, dto);
  }

  @Get('rider/payout-account')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.RIDER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Fetch saved rider payout bank account (rider only)' })
  async getRiderPayoutAccount(@Auth() auth: ITokenPayload) {
    return this.accountService.getRiderPayoutAccount(auth);
  }

  @Patch('rider/payout-account')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.RIDER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Edit rider payout bank account (rider only)' })
  async updateRiderPayoutAccount(
    @Auth() auth: ITokenPayload,
    @Body() dto: UpdatePayoutAccountDTO,
  ) {
    return this.accountService.updateRiderPayoutAccount(auth, dto);
  }

  @Post('business/payout-account')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.BUSINESS)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Save business payout bank account (business only)' })
  async saveBusinessPayoutAccount(
    @Auth() auth: ITokenPayload,
    @Body() dto: SavePayoutAccountDTO,
  ) {
    return this.accountService.saveBusinessPayoutAccount(auth, dto);
  }

  @Get('business/payout-account')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.BUSINESS)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Fetch saved business payout bank account (business only)' })
  async getBusinessPayoutAccount(@Auth() auth: ITokenPayload) {
    return this.accountService.getBusinessPayoutAccount(auth);
  }

  @Patch('business/payout-account')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.BUSINESS)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Edit business payout bank account (business only)' })
  async updateBusinessPayoutAccount(
    @Auth() auth: ITokenPayload,
    @Body() dto: UpdatePayoutAccountDTO,
  ) {
    return this.accountService.updateBusinessPayoutAccount(auth, dto);
  }
}
