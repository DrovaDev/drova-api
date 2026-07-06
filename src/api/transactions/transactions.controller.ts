import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { Auth, Roles } from 'src/interfaces/customs.decorator';
import { AuthGuard } from '../authentication/guards/authentication.guard';
import { RolesGuard } from '../authentication/guards/roles.guard';
import { UserType } from 'src/constants';
import type { ITokenPayload } from 'src/interfaces/token.interface';
import { TransactionsService } from './transactions.service';
import {
  TransactionQueryDTO,
  RequestPayoutDTO,
  PayoutQueryDTO,
} from './dtos/transaction.dto';

@Controller('transactions')
@ApiTags('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.BUSINESS)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Fetch paginated transactions for the authenticated business',
  })
  async getBusinessTransactions(
    @Auth() auth: ITokenPayload,
    @Query() query: TransactionQueryDTO,
  ) {
    return await this.transactionsService.getMyTransactions(auth, query);
  }

  @Get('rider')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.RIDER)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Fetch paginated transactions for the authenticated rider',
  })
  async getRiderTransactions(
    @Auth() auth: ITokenPayload,
    @Query() query: TransactionQueryDTO,
  ) {
    return await this.transactionsService.getMyTransactions(auth, query);
  }

  @Get('order/:orderId')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.BUSINESS)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Fetch all journals for a specific order (business only)',
  })
  async getOrderTransactions(@Param('orderId') orderId: string) {
    return await this.transactionsService.getJournalsByOrder(orderId);
  }

  @Get(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.BUSINESS, UserType.RIDER)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Fetch a single transaction (journal) by ID',
  })
  async getTransactionById(@Param('id') id: string) {
    return await this.transactionsService.getJournalById(id);
  }

  @Post('payouts/request')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.BUSINESS)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Request a withdrawal payout (business)',
  })
  async requestBusinessPayout(
    @Auth() auth: ITokenPayload,
    @Body() payload: RequestPayoutDTO,
  ) {
    return await this.transactionsService.requestPayoutForUser(auth, payload);
  }

  @Post('payouts/rider/request')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.RIDER)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Request a withdrawal payout (rider)',
  })
  async requestRiderPayout(
    @Auth() auth: ITokenPayload,
    @Body() payload: RequestPayoutDTO,
  ) {
    return await this.transactionsService.requestPayoutForUser(auth, payload);
  }

  @Get('payouts/mine')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.BUSINESS)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Fetch paginated payouts for the authenticated business',
  })
  async getBusinessPayouts(
    @Auth() auth: ITokenPayload,
    @Query() query: PayoutQueryDTO,
  ) {
    return await this.transactionsService.getMyPayouts(auth, query);
  }

  @Get('payouts/rider')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.RIDER)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Fetch paginated payouts for the authenticated rider',
  })
  async getRiderPayouts(
    @Auth() auth: ITokenPayload,
    @Query() query: PayoutQueryDTO,
  ) {
    return await this.transactionsService.getMyPayouts(auth, query);
  }

  @Get('payouts/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.BUSINESS, UserType.RIDER)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Fetch a single payout by ID (scoped to your wallet)',
  })
  async getPayoutById(@Auth() auth: ITokenPayload, @Param('id') id: string) {
    return await this.transactionsService.getPayoutById(id, auth);
  }
}
