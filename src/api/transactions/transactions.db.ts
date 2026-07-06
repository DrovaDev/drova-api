import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LedgerJournal } from './schemas/transactions.schema';
import { LedgerEntry } from './schemas/transaction-entries.schema';
import { Payout } from './schemas/payout.schema';
import { Wallet } from 'src/api/wallets/schemas/wallet.schema';
import {
  JournalStatus,
  JournalType,
  LedgerEntryDirection,
  PayoutStatus,
} from 'src/constants';
import { CreateJournalInput } from 'src/interfaces/journal.interface';

export interface OrderJournalGroup {
  orderId: string | null;
  referenceCode: string | null;
  latestAt: Date;
  journals: LedgerJournal[];
}

@Injectable()
export class TransactionsDb {
  constructor(
    @InjectRepository(LedgerJournal)
    private readonly journalModel: Repository<LedgerJournal>,
    @InjectRepository(LedgerEntry)
    private readonly entryModel: Repository<LedgerEntry>,
    @InjectRepository(Payout)
    private readonly payoutModel: Repository<Payout>,
  ) {}

  /**
   * Creates a journal with entries and updates wallet balances atomically.
   * Status starts as PENDING. Call postJournal to finalize.
   */
  async createJournal(input: CreateJournalInput): Promise<LedgerJournal> {
    return this.journalModel.manager.transaction(async (manager) => {
      const journal = await manager.save(LedgerJournal, {
        reference: input.reference,
        type: input.type,
        status: JournalStatus.PENDING,
        orderId: input.orderId,
        reversalOfId: input.reversalOfId,
        metadata: input.metadata,
      } as LedgerJournal);

      const entryEntities = input.entries.map((e) => ({
        journalId: journal.id,
        walletId: e.walletId,
        direction: e.direction,
        amount: e.amount,
        currency: e.currency || 'NGN',
      }));

      const totalCredits = input.entries
        .filter((e) => e.direction === LedgerEntryDirection.CREDIT)
        .reduce((sum, e) => sum + e.amount, 0);

      const totalDebits = input.entries
        .filter((e) => e.direction === LedgerEntryDirection.DEBIT)
        .reduce((sum, e) => sum + e.amount, 0);

      if (Math.abs(totalCredits - totalDebits) > 0.001) {
        throw new Error(
          `Journal entries are unbalanced: credits=${totalCredits}, debits=${totalDebits}`,
        );
      }
      await manager.save(LedgerEntry, entryEntities as LedgerEntry[]);

      // Update ledgerBalance for each entry (tracks pending + posted)
      for (const entry of input.entries) {
        const sign = entry.direction === LedgerEntryDirection.CREDIT ? 1 : -1;
        await manager
          .createQueryBuilder()
          .update(Wallet)
          .set({
            ledgerBalance: () => `"ledgerBalance" + ${sign * entry.amount}`,
          })
          .where('id = :walletId', { walletId: entry.walletId })
          .execute();
      }

      return manager.findOne(LedgerJournal, {
        where: { id: journal.id },
        relations: ['entries'],
      }) as Promise<LedgerJournal>;
    });
  }

  /**
   * Posts a PENDING journal — updates status to POSTED,
   * sets postedAt, and updates wallet available balances.
   */
  async postJournal(journalId: string): Promise<LedgerJournal> {
    return this.journalModel.manager.transaction(async (manager) => {
      const journal = await manager.findOne(LedgerJournal, {
        where: { id: journalId },
        relations: ['entries'],
        lock: { mode: 'pessimistic_write' },
      });

      if (!journal) {
        throw new Error('Journal not found');
      }

      if (journal.status !== JournalStatus.PENDING) {
        throw new Error(`Cannot post journal in status: ${journal.status}`);
      }

      journal.status = JournalStatus.POSTED;
      journal.postedAt = new Date();
      await manager.save(LedgerJournal, journal);

      // Update available balance for each entry
      for (const entry of journal.entries) {
        const sign = entry.direction === LedgerEntryDirection.CREDIT ? 1 : -1;
        await manager
          .createQueryBuilder()
          .update(Wallet)
          .set({
            balance: () => `"balance" + ${sign * entry.amount}`,
          })
          .where('id = :walletId', { walletId: entry.walletId })
          .execute();
      }

      return journal;
    });
  }

  /**
   * Creates a journal and immediately posts it in one transaction.
   */
  async createAndPostJournal(
    input: CreateJournalInput,
  ): Promise<LedgerJournal> {
    return this.journalModel.manager.transaction(async (manager) => {
      const journal = await manager.save(LedgerJournal, {
        reference: input.reference,
        type: input.type,
        status: JournalStatus.POSTED,
        orderId: input.orderId,
        reversalOfId: input.reversalOfId,
        metadata: input.metadata,
        postedAt: new Date(),
      } as LedgerJournal);

      const entryEntities = input.entries.map((e) => ({
        journalId: journal.id,
        walletId: e.walletId,
        direction: e.direction,
        amount: e.amount,
        currency: e.currency || 'NGN',
      }));

      await manager.save(LedgerEntry, entryEntities as LedgerEntry[]);

      // Update both ledgerBalance and balance since we're posting immediately
      for (const entry of input.entries) {
        const sign = entry.direction === LedgerEntryDirection.CREDIT ? 1 : -1;
        await manager
          .createQueryBuilder()
          .update(Wallet)
          .set({
            balance: () => `"balance" + ${sign * entry.amount}`,
            ledgerBalance: () => `"ledgerBalance" + ${sign * entry.amount}`,
          })
          .where('id = :walletId', { walletId: entry.walletId })
          .execute();
      }

      return manager.findOne(LedgerJournal, {
        where: { id: journal.id },
        relations: ['entries'],
      }) as Promise<LedgerJournal>;
    });
  }

  /**
   * Marks a journal as FAILED and reverses ledgerBalance changes.
   */
  async failJournal(journalId: string): Promise<LedgerJournal> {
    return this.journalModel.manager.transaction(async (manager) => {
      const journal = await manager.findOne(LedgerJournal, {
        where: { id: journalId },
        relations: ['entries'],
        lock: { mode: 'pessimistic_write' },
      });

      if (!journal) {
        throw new Error('Journal not found');
      }

      if (journal.status !== JournalStatus.PENDING) {
        throw new Error(`Cannot fail journal in status: ${journal.status}`);
      }

      journal.status = JournalStatus.FAILED;
      await manager.save(LedgerJournal, journal);

      // Reverse the ledgerBalance updates made at creation
      for (const entry of journal.entries) {
        const sign = entry.direction === LedgerEntryDirection.CREDIT ? -1 : 1;
        await manager
          .createQueryBuilder()
          .update(Wallet)
          .set({
            ledgerBalance: () => `"ledgerBalance" + ${sign * entry.amount}`,
          })
          .where('id = :walletId', { walletId: entry.walletId })
          .execute();
      }

      return journal;
    });
  }

  /**
   * Reverses a POSTED journal by creating a mirror REVERSAL journal.
   */
  async reverseJournal(
    journalId: string,
    reversalReference: string,
    metadata?: Record<string, any>,
  ): Promise<LedgerJournal> {
    return this.journalModel.manager.transaction(async (manager) => {
      const original = await manager.findOne(LedgerJournal, {
        where: { id: journalId },
        relations: ['entries'],
        lock: { mode: 'pessimistic_write' },
      });

      if (!original) {
        throw new Error('Journal not found');
      }

      if (original.status !== JournalStatus.POSTED) {
        throw new Error(`Cannot reverse journal in status: ${original.status}`);
      }

      // Mark original as REVERSED
      original.status = JournalStatus.REVERSED;
      await manager.save(LedgerJournal, original);

      // Create reversal journal with mirrored entries
      const reversalJournal = await manager.save(
        LedgerJournal,
        manager.create(LedgerJournal, {
          reference: reversalReference,
          type: JournalType.REVERSAL,
          status: JournalStatus.POSTED,
          orderId: original.orderId,
          reversalOfId: original.id,
          metadata: { ...metadata, originalReference: original.reference },
          postedAt: new Date(),
        }),
      );

      const mirroredEntries = original.entries.map((entry) => ({
        journalId: reversalJournal.id,
        walletId: entry.walletId,
        direction:
          entry.direction === LedgerEntryDirection.CREDIT
            ? LedgerEntryDirection.DEBIT
            : LedgerEntryDirection.CREDIT,
        amount: entry.amount,
        currency: entry.currency,
      }));

      await manager.save(LedgerEntry, mirroredEntries as LedgerEntry[]);

      // Reverse both balance and ledgerBalance
      for (const entry of original.entries) {
        const sign = entry.direction === LedgerEntryDirection.CREDIT ? -1 : 1;
        await manager
          .createQueryBuilder()
          .update(Wallet)
          .set({
            balance: () => `"balance" + ${sign * entry.amount}`,
            ledgerBalance: () => `"ledgerBalance" + ${sign * entry.amount}`,
          })
          .where('id = :walletId', { walletId: entry.walletId })
          .execute();
      }

      return manager.findOne(LedgerJournal, {
        where: { id: reversalJournal.id },
        relations: ['entries'],
      }) as Promise<LedgerJournal>;
    });
  }

  async findJournalById(journalId: string): Promise<LedgerJournal | null> {
    return this.journalModel.findOne({
      where: { id: journalId },
      relations: ['entries', 'entries.wallet'],
    });
  }

  async findJournalByReference(
    reference: string,
  ): Promise<LedgerJournal | null> {
    return this.journalModel.findOne({
      where: { reference },
      relations: ['entries'],
    });
  }

  async findJournalsByOrder(orderId: string): Promise<LedgerJournal[]> {
    return this.journalModel.find({
      where: { orderId },
      relations: ['entries'],
      order: { createdAt: 'ASC' },
    });
  }

  async findEntriesByWallet(
    walletId: string,
    opts: {
      offset: number;
      limit: number;
      sortOrder: 'ASC' | 'DESC';
      type?: JournalType;
      orderId?: string;
    },
  ): Promise<{ entries: LedgerEntry[]; count: number }> {
    const qb = this.entryModel
      .createQueryBuilder('entry')
      .innerJoinAndSelect('entry.journal', 'journal')
      .where('entry.walletId = :walletId', { walletId })
      .andWhere('journal.status IN (:...statuses)', {
        statuses: [
          JournalStatus.POSTED,
          JournalStatus.REVERSED,
          JournalStatus.PENDING,
        ],
      });

    if (opts.type) {
      qb.andWhere('journal.type = :type', { type: opts.type });
    }
    if (opts.orderId) {
      qb.andWhere('journal.orderId = :orderId', { orderId: opts.orderId });
    }

    const count = await qb.getCount();

    const entries = await qb
      .orderBy('entry.createdAt', opts.sortOrder)
      .skip(opts.offset)
      .take(opts.limit)
      .getMany();

    return { entries, count };
  }

  async findPayoutsByWallet(
    walletId: string,
    opts: {
      offset: number;
      limit: number;
      sortOrder: 'ASC' | 'DESC';
      status?: PayoutStatus;
    },
  ): Promise<{ payouts: Payout[]; count: number }> {
    const where: Record<string, any> = { walletId };
    if (opts.status) {
      where.status = opts.status;
    }

    const [payouts, count] = await this.payoutModel.findAndCount({
      where,
      relations: ['journal'],
      order: { createdAt: opts.sortOrder },
      skip: opts.offset,
      take: opts.limit,
    });

    return { payouts, count };
  }

  /**
   * Computes the authoritative balance for a wallet from ledger entries.
   * Use for reconciliation — compare against Wallet.balance.
   */
  async computeWalletBalance(walletId: string): Promise<number> {
    const result = await this.entryModel
      .createQueryBuilder('entry')
      .innerJoin('entry.journal', 'journal')
      .select(
        `SUM(CASE WHEN entry.direction = '${LedgerEntryDirection.CREDIT}' THEN entry.amount ELSE -entry.amount END)`,
        'balance',
      )
      .where('entry.walletId = :walletId', { walletId })
      .andWhere('journal.status = :status', {
        status: JournalStatus.POSTED,
      })
      .getRawOne();

    return Number.parseFloat(result?.balance || '0');
  }

  async createPayout(payout: Partial<Payout>): Promise<Payout> {
    return this.payoutModel.save(payout as Payout);
  }

  async updatePayoutStatus(
    payoutId: string,
    status: PayoutStatus,
    providerReference?: string,
  ): Promise<void> {
    const update: Partial<Payout> = { status };
    if (providerReference) {
      update.providerReference = providerReference;
    }
    await this.payoutModel.update(payoutId, update);
  }

  async findPayoutById(payoutId: string): Promise<Payout | null> {
    return this.payoutModel.findOne({
      where: { id: payoutId },
      relations: ['journal', 'journal.entries'],
    });
  }

  async findPayoutByIdempotencyKey(key: string): Promise<Payout | null> {
    return this.payoutModel.findOne({
      where: { idempotencyKey: key },
    });
  }

  async saveWebhookMeta(
    journalId: string,
    webhookMeta: Record<string, any>,
  ): Promise<void> {
    await this.journalModel.update(journalId, { webhookMeta });
  }

  async findJournalByOrderId(orderId: string): Promise<LedgerJournal | null> {
    return this.journalModel.findOne({
      where: { orderId },
      order: { createdAt: 'DESC' },
    });
  }
}
