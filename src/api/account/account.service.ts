import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { NombaService } from 'src/services/nomba.service';
import { RiderDb } from 'src/api/rider/rider.db';
import { BusinessDb } from 'src/api/business/business.db';
import { BankAccountOwnerType } from './schemas/bank-account.schema';
import { AccountDb } from './account.db';
import {
  SavePayoutAccountDTO,
  UpdatePayoutAccountDTO,
  ResolveAccountQueryDTO,
} from './dtos/account.dto';
import type { ITokenPayload } from 'src/interfaces/token.interface';
import { IResponse } from 'src/interfaces/response.interface';

@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    private readonly accountDb: AccountDb,
    private readonly riderDb: RiderDb,
    private readonly businessDb: BusinessDb,
    private readonly nombaService: NombaService,
  ) {}

  async getBanks(): Promise<IResponse> {
    try {
      const data = await this.nombaService.fetchBanks();
      return {
        status: 'success',
        statusCode: 200,
        message: 'Banks fetched successfully',
        data,
      };
    } catch (error) {
      this.logger.error('Failed to fetch banks', error);
      throw new InternalServerErrorException('Failed to fetch banks');
    }
  }

  async resolveAccount(dto: ResolveAccountQueryDTO): Promise<IResponse> {
    try {
      const data = await this.nombaService.lookupBankAccount({
        bankCode: dto.bankCode,
        accountNumber: dto.accountNumber,
      });
      return {
        status: 'success',
        statusCode: 200,
        message: 'Account resolved successfully',
        data,
      };
    } catch (error) {
      this.logger.error('Failed to resolve account', error);
      throw new InternalServerErrorException('Failed to resolve account');
    }
  }

  async saveRiderPayoutAccount(
    auth: ITokenPayload,
    dto: SavePayoutAccountDTO,
  ): Promise<IResponse> {
    const ownerId = await this.resolveOwnerIdForRider(auth.id);
    return this.savePayoutAccount(ownerId, BankAccountOwnerType.RIDER, dto);
  }

  async getRiderPayoutAccount(auth: ITokenPayload): Promise<IResponse> {
    const ownerId = await this.resolveOwnerIdForRider(auth.id);
    return this.fetchPayoutAccount(ownerId, BankAccountOwnerType.RIDER);
  }

  async updateRiderPayoutAccount(
    auth: ITokenPayload,
    dto: UpdatePayoutAccountDTO,
  ): Promise<IResponse> {
    const ownerId = await this.resolveOwnerIdForRider(auth.id);
    return this.patchPayoutAccount(ownerId, BankAccountOwnerType.RIDER, dto);
  }

  async saveBusinessPayoutAccount(
    auth: ITokenPayload,
    dto: SavePayoutAccountDTO,
  ): Promise<IResponse> {
    const ownerId = await this.resolveOwnerIdForBusiness(auth.id);
    return this.savePayoutAccount(ownerId, BankAccountOwnerType.BUSINESS, dto);
  }

  async getBusinessPayoutAccount(auth: ITokenPayload): Promise<IResponse> {
    const ownerId = await this.resolveOwnerIdForBusiness(auth.id);
    return this.fetchPayoutAccount(ownerId, BankAccountOwnerType.BUSINESS);
  }

  async updateBusinessPayoutAccount(
    auth: ITokenPayload,
    dto: UpdatePayoutAccountDTO,
  ): Promise<IResponse> {
    const ownerId = await this.resolveOwnerIdForBusiness(auth.id);
    return this.patchPayoutAccount(ownerId, BankAccountOwnerType.BUSINESS, dto);
  }

  private async resolveOwnerIdForRider(authId: string): Promise<string> {
    const rider = await this.riderDb.findRiderByAuthId(authId);
    if (!rider) throw new NotFoundException('Rider profile not found');
    return rider.id;
  }

  private async resolveOwnerIdForBusiness(authId: string): Promise<string> {
    const business = await this.businessDb.findBusinessByAuthId(authId);
    if (!business) throw new NotFoundException('Business profile not found');
    return business.id;
  }

  private async savePayoutAccount(
    ownerId: string,
    ownerType: BankAccountOwnerType,
    dto: SavePayoutAccountDTO,
  ): Promise<IResponse> {
    const saved = await this.accountDb.upsertBankAccount({
      ownerId,
      ownerType,
      ...dto,
    });
    return {
      status: 'success',
      statusCode: 200,
      message: 'Payout account saved successfully',
      data: saved,
    };
  }

  private async fetchPayoutAccount(
    ownerId: string,
    ownerType: BankAccountOwnerType,
  ): Promise<IResponse> {
    const account = await this.accountDb.findBankAccount(ownerId, ownerType);
    return {
      status: 'success',
      statusCode: 200,
      message: account ? 'Payout account fetched' : 'No payout account saved',
      data: account ?? null,
    };
  }

  private async patchPayoutAccount(
    ownerId: string,
    ownerType: BankAccountOwnerType,
    dto: UpdatePayoutAccountDTO,
  ): Promise<IResponse> {
    const existing = await this.accountDb.findBankAccount(ownerId, ownerType);
    if (!existing)
      throw new NotFoundException('No payout account found to update');

    const updated = await this.accountDb.updateBankAccount(
      ownerId,
      ownerType,
      dto,
    );
    return {
      status: 'success',
      statusCode: 200,
      message: 'Payout account updated successfully',
      data: updated,
    };
  }
}
