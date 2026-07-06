import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BankAccount,
  BankAccountOwnerType,
} from './schemas/bank-account.schema';

@Injectable()
export class AccountDb {
  constructor(
    @InjectRepository(BankAccount)
    private readonly bankAccountModel: Repository<BankAccount>,
  ) {}

  findBankAccount(
    ownerId: string,
    ownerType: BankAccountOwnerType,
  ): Promise<BankAccount | null> {
    return this.bankAccountModel.findOne({ where: { ownerId, ownerType } });
  }

  async upsertBankAccount(data: {
    ownerId: string;
    ownerType: BankAccountOwnerType;
    bankCode: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
  }): Promise<BankAccount> {
    await this.bankAccountModel.upsert(data, {
      conflictPaths: ['ownerId', 'ownerType'],
    });
    const result = await this.bankAccountModel.findOne({
      where: { ownerId: data.ownerId, ownerType: data.ownerType },
    });
    return result!;
  }

  async updateBankAccount(
    ownerId: string,
    ownerType: BankAccountOwnerType,
    updates: Partial<
      Pick<
        BankAccount,
        'bankCode' | 'bankName' | 'accountNumber' | 'accountName'
      >
    >,
  ): Promise<BankAccount | null> {
    await this.bankAccountModel.update({ ownerId, ownerType }, updates);
    return this.findBankAccount(ownerId, ownerType);
  }
}
