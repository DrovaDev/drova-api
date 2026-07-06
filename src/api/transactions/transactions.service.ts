import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  Logger,
  Inject,
} from '@nestjs/common';
import { IResponse } from 'src/interfaces/response.interface';
import { LedgerJournal } from './schemas/transactions.schema';
import { TransactionsDb } from './transactions.db';
import { WalletDb } from 'src/api/wallets/wallet.db';
import { AccountDb } from 'src/api/account/account.db';
import { BankAccountOwnerType } from 'src/api/account/schemas/bank-account.schema';
import { Helpers } from 'src/helpers/random-generator';
import { UtilsService } from 'src/helpers/utils.service';
import {
  JournalType,
  LedgerEntryDirection,
  WalletOwnerType,
  PayoutStatus,
  UserType,
} from 'src/constants';
import { CreateEntryInput } from 'src/interfaces/journal.interface';
import type { ITokenPayload } from 'src/interfaces/token.interface';
import {
  TransactionQueryDTO,
  RequestPayoutDTO,
  PayoutQueryDTO,
} from './dtos/transaction.dto';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from 'src/queues/queues.module';
import { PayoutsQueueProducer } from './queues/payouts.queue.producer';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    private readonly transactionsDb: TransactionsDb,
    private readonly walletDb: WalletDb,
    private readonly accountDb: AccountDb,
    private readonly helpers: Helpers,
    private readonly utilService: UtilsService,
    private readonly payoutsQueueProducer: PayoutsQueueProducer,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  private validateAmount(amount: number): void {
    if (!amount || amount <= 0) {
      throw new BadRequestException('Amount must be greater than zero');
    }
  }

  /**
   * Escrow hold — called when customer payment is confirmed.
   * DEBIT clearing wallet, CREDIT business wallet (ledgerBalance only).
   */
  async escrowHold(opts: {
    orderId: string;
    businessWalletId: string;
    clearingWalletId: string;
    amount: number;
    metadata?: Record<string, any>;
  }): Promise<IResponse> {
    this.validateAmount(opts.amount);

    const reference = `JRNL-ESC-${this.helpers.generateTxReference()}`;

    try {
      const journal = await this.transactionsDb.createJournal({
        reference,
        type: JournalType.ESCROW_HOLD,
        orderId: opts.orderId,
        metadata: opts.metadata,
        entries: [
          {
            walletId: opts.clearingWalletId,
            direction: LedgerEntryDirection.DEBIT,
            amount: opts.amount,
          },
          {
            walletId: opts.businessWalletId,
            direction: LedgerEntryDirection.CREDIT,
            amount: opts.amount,
          },
        ],
      });

      return {
        status: 'success',
        statusCode: 201,
        message: 'Escrow hold created',
        data: journal,
      };
    } catch (error) {
      this.logger.error('Failed to create escrow hold', error);
      throw new InternalServerErrorException('Failed to create escrow hold');
    }
  }

  /**
   * Escrow release + settlement — called when order is completed.
   * Posts the escrow journal, then creates a settlement journal
   * splitting between business and platform.
   */
  async settleOrder(opts: {
    orderId: string;
    businessWalletId: string;
    platformWalletId: string;
    clearingWalletId: string;
    totalAmount: number;
    platformCommission: number;
    metadata?: Record<string, any>;
  }): Promise<IResponse> {
    this.validateAmount(opts.totalAmount);
    if (opts.platformCommission < 0) {
      throw new BadRequestException('Commission cannot be negative');
    }
    if (opts.platformCommission > opts.totalAmount) {
      throw new BadRequestException('Commission cannot exceed total amount');
    }

    const businessPayout = opts.totalAmount - opts.platformCommission;
    const reference = `JRNL-SET-${this.helpers.generateTxReference()}`;

    const entries: CreateEntryInput[] = [
      {
        walletId: opts.clearingWalletId,
        direction: LedgerEntryDirection.DEBIT,
        amount: opts.totalAmount,
      },
      {
        walletId: opts.businessWalletId,
        direction: LedgerEntryDirection.CREDIT,
        amount: businessPayout,
      },
    ];

    if (opts.platformCommission > 0) {
      entries.push({
        walletId: opts.platformWalletId,
        direction: LedgerEntryDirection.CREDIT,
        amount: opts.platformCommission,
      });
    }

    try {
      const journal = await this.transactionsDb.createAndPostJournal({
        reference,
        type: JournalType.ORDER_SETTLEMENT,
        orderId: opts.orderId,
        metadata: {
          ...opts.metadata,
          totalAmount: opts.totalAmount,
          platformCommission: opts.platformCommission,
          businessPayout,
        },
        entries,
      });

      return {
        status: 'success',
        statusCode: 201,
        message: 'Order settled successfully',
        data: journal,
      };
    } catch (error) {
      this.logger.error('Failed to settle order', error);
      throw new InternalServerErrorException('Failed to settle order');
    }
  }

  /**
   * Business → Rider internal payout (with optional platform fee split).
   */
  async businessToRiderPayout(opts: {
    orderId?: string;
    businessWalletId: string;
    riderWalletId: string;
    platformWalletId?: string;
    totalAmount: number;
    platformFee?: number;
    metadata?: Record<string, any>;
  }): Promise<IResponse> {
    this.validateAmount(opts.totalAmount);
    const fee = opts.platformFee || 0;
    if (fee < 0) {
      throw new BadRequestException('Platform fee cannot be negative');
    }
    if (fee > opts.totalAmount) {
      throw new BadRequestException('Platform fee cannot exceed total');
    }

    const riderAmount = opts.totalAmount - fee;
    const reference = `JRNL-B2R-${this.helpers.generateTxReference()}`;

    // Verify business has sufficient available balance
    const businessWallet = await this.walletDb.findWalletById(
      opts.businessWalletId,
    );
    if (!businessWallet) {
      throw new NotFoundException('Business wallet not found');
    }
    if (businessWallet.balance < opts.totalAmount) {
      throw new BadRequestException('Insufficient wallet balance');
    }

    const entries: CreateEntryInput[] = [
      {
        walletId: opts.businessWalletId,
        direction: LedgerEntryDirection.DEBIT,
        amount: opts.totalAmount,
      },
      {
        walletId: opts.riderWalletId,
        direction: LedgerEntryDirection.CREDIT,
        amount: riderAmount,
      },
    ];

    if (fee > 0 && opts.platformWalletId) {
      entries.push({
        walletId: opts.platformWalletId,
        direction: LedgerEntryDirection.CREDIT,
        amount: fee,
      });
    }

    try {
      const journal = await this.transactionsDb.createAndPostJournal({
        reference,
        type: JournalType.BUSINESS_TO_RIDER_PAYOUT,
        orderId: opts.orderId,
        metadata: {
          ...opts.metadata,
          totalAmount: opts.totalAmount,
          riderAmount,
          platformFee: fee,
        },
        entries,
      });

      return {
        status: 'success',
        statusCode: 201,
        message: 'Rider payout completed',
        data: journal,
      };
    } catch (error) {
      this.logger.error('Failed to process rider payout', error);
      throw new InternalServerErrorException('Failed to process rider payout');
    }
  }

  /**
   * Escrow refund — reverses an escrow hold (e.g. order cancellation).
   */
  async escrowRefund(opts: {
    orderId: string;
    clearingWalletId: string;
    businessWalletId: string;
    amount: number;
    metadata?: Record<string, any>;
  }): Promise<IResponse> {
    this.validateAmount(opts.amount);
    const reference = `JRNL-REF-${this.helpers.generateTxReference()}`;

    try {
      const journal = await this.transactionsDb.createAndPostJournal({
        reference,
        type: JournalType.ESCROW_REFUND,
        orderId: opts.orderId,
        metadata: opts.metadata,
        entries: [
          {
            walletId: opts.businessWalletId,
            direction: LedgerEntryDirection.DEBIT,
            amount: opts.amount,
          },
          {
            walletId: opts.clearingWalletId,
            direction: LedgerEntryDirection.CREDIT,
            amount: opts.amount,
          },
        ],
      });

      return {
        status: 'success',
        statusCode: 201,
        message: 'Escrow refund processed',
        data: journal,
      };
    } catch (error) {
      this.logger.error('Failed to process escrow refund', error);
      throw new InternalServerErrorException('Failed to process escrow refund');
    }
  }

  /**
   * Reverse a posted journal (generic — creates mirror REVERSAL journal).
   */
  async reverseJournal(journalId: string): Promise<IResponse> {
    const reversalRef = `JRNL-REV-${this.helpers.generateTxReference()}`;

    try {
      const reversal = await this.transactionsDb.reverseJournal(
        journalId,
        reversalRef,
      );

      return {
        status: 'success',
        statusCode: 201,
        message: 'Journal reversed successfully',
        data: reversal,
      };
    } catch (error) {
      if ((error as Error).message?.includes('Cannot reverse')) {
        throw new BadRequestException((error as Error).message);
      }
      this.logger.error('Failed to reverse journal', error);
      throw new InternalServerErrorException('Failed to reverse journal');
    }
  }

  async requestWithdrawal(opts: {
    walletId: string;
    amount: number;
    destination: {
      bankCode: string;
      accountNumber: string;
      accountName: string;
    };
    walletOwnerType: WalletOwnerType;
    metadata?: Record<string, any>;
  }): Promise<IResponse> {
    this.validateAmount(opts.amount);

    const wallet = await this.walletDb.findWalletById(opts.walletId);
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }
    if (wallet.balance < opts.amount) {
      throw new BadRequestException('Insufficient wallet balance');
    }

    // Prevent identical transfers (same wallet → same account + amount) within 10 seconds
    const dedupKey = `payout:dedup:${opts.walletId}:${opts.destination.bankCode}:${opts.destination.accountNumber}:${opts.amount}`;
    const dedupAcquired = await this.redis.set(dedupKey, '1', 'EX', 10, 'NX');
    if (!dedupAcquired) {
      throw new BadRequestException(
        'A transfer to this account for this amount was already requested within the last 10 seconds. Please wait before retrying.',
      );
    }

    let idempotencyKey: string;
    do {
      idempotencyKey = `WDR-${this.helpers.generateTxReference()}`;
    } while (
      await this.transactionsDb.findPayoutByIdempotencyKey(idempotencyKey)
    );

    const journalType =
      opts.walletOwnerType === WalletOwnerType.RIDER
        ? JournalType.RIDER_WITHDRAWAL
        : JournalType.BUSINESS_WITHDRAWAL;

    const reference = `JRNL-WDR-${this.helpers.generateTxReference()}`;

    const clearingWallet = await this.walletDb.findSystemWallet(
      WalletOwnerType.CLEARING,
    );
    if (!clearingWallet) {
      throw new InternalServerErrorException(
        'Clearing wallet not found — cannot process withdrawal',
      );
    }

    try {
      // Create PENDING journal — DEBIT owner wallet, CREDIT clearing wallet.
      // balanceField:'balance' ensures available balance is reserved immediately
      // without touching ledgerBalance (which tracks escrow, not withdrawals).
      const journal = await this.transactionsDb.createJournal({
        reference,
        type: journalType,
        metadata: opts.metadata,
        balanceField: 'balance',
        entries: [
          {
            walletId: opts.walletId,
            direction: LedgerEntryDirection.DEBIT,
            amount: opts.amount,
          },
          {
            walletId: clearingWallet.id,
            direction: LedgerEntryDirection.CREDIT,
            amount: opts.amount,
          },
        ],
      });

      const payout = await this.transactionsDb.createPayout({
        walletId: opts.walletId,
        journalId: journal.id,
        amount: opts.amount,
        destination: opts.destination,
        status: PayoutStatus.REQUESTED,
        idempotencyKey,
        metadata: opts.metadata,
      });

      await this.payoutsQueueProducer.enqueueProcessPayout(payout.id);

      return {
        status: 'success',
        statusCode: 201,
        message: 'Withdrawal requested',
        data: { payout, journal },
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      this.logger.error('Failed to request withdrawal', error);
      throw new InternalServerErrorException('Failed to request withdrawal');
    }
  }

  /**
   * Called when provider confirms payout success — posts the journal.
   */
  async confirmWithdrawal(
    payoutId: string,
    providerReference?: string,
  ): Promise<IResponse> {
    const payout = await this.transactionsDb.findPayoutById(payoutId);
    if (!payout) {
      throw new NotFoundException('Payout not found');
    }
    if (
      payout.status !== PayoutStatus.REQUESTED &&
      payout.status !== PayoutStatus.PROCESSING
    ) {
      throw new BadRequestException(
        `Cannot confirm payout in status: ${payout.status}`,
      );
    }

    try {
      await this.transactionsDb.updatePayoutStatus(
        payoutId,
        PayoutStatus.SUCCESS,
        providerReference,
      );

      if (payout.journalId) {
        // Balance was already deducted at requestWithdrawal time — skip wallet updates.
        await this.transactionsDb.postJournal(payout.journalId, {
          skipWalletUpdates: true,
        });
      }

      return {
        status: 'success',
        statusCode: 200,
        message: 'Withdrawal confirmed',
        data: { payoutId },
      };
    } catch (error) {
      this.logger.error('Failed to confirm withdrawal', error);
      throw new InternalServerErrorException('Failed to confirm withdrawal');
    }
  }

  /**
   * Called when provider reports payout failure — fails the journal and releases hold.
   */
  async failWithdrawal(payoutId: string): Promise<IResponse> {
    const payout = await this.transactionsDb.findPayoutById(payoutId);
    if (!payout) {
      throw new NotFoundException('Payout not found');
    }
    if (
      payout.status !== PayoutStatus.REQUESTED &&
      payout.status !== PayoutStatus.PROCESSING
    ) {
      throw new BadRequestException(
        `Cannot fail payout in status: ${payout.status}`,
      );
    }

    try {
      await this.transactionsDb.updatePayoutStatus(
        payoutId,
        PayoutStatus.FAILED,
      );

      if (payout.journalId) {
        // Reverse the balance reservation made at requestWithdrawal time.
        await this.transactionsDb.failJournal(payout.journalId, {
          balanceField: 'balance',
        });
      }

      return {
        status: 'success',
        statusCode: 200,
        message: 'Withdrawal failed and funds released',
        data: { payoutId },
      };
    } catch (error) {
      this.logger.error('Failed to handle withdrawal failure', error);
      throw new InternalServerErrorException(
        'Failed to handle withdrawal failure',
      );
    }
  }

  /**
   * Called by the payout_success webhook — looks up the payout by the
   * merchantTxRef we passed to Nomba (which equals the idempotencyKey) and
   * posts the journal to finalise the withdrawal.
   */
  async processPayoutWebhookSuccess(
    merchantTxRef: string,
    providerReference?: string,
  ): Promise<void> {
    const payout =
      await this.transactionsDb.findPayoutByIdempotencyKey(merchantTxRef);
    if (!payout) {
      this.logger.warn(
        `payout_success webhook: payout not found merchantTxRef=${merchantTxRef}`,
      );
      return;
    }
    if (payout.status === PayoutStatus.SUCCESS) {
      return;
    }
    await this.confirmWithdrawal(payout.id, providerReference);
  }

  /**
   * Called by the payout_failed / payout_refund webhook — looks up the payout
   * and fails the journal to release the ledger hold.
   */
  async processPayoutWebhookFailed(
    merchantTxRef: string,
    isRefund = false,
  ): Promise<void> {
    const payout =
      await this.transactionsDb.findPayoutByIdempotencyKey(merchantTxRef);
    if (!payout) {
      this.logger.warn(
        `payout_failed webhook: payout not found merchantTxRef=${merchantTxRef}`,
      );
      return;
    }
    if (payout.status === PayoutStatus.FAILED) {
      return;
    }
    if (payout.status === PayoutStatus.SUCCESS) {
      // A refund arrives after a successful transfer — the money was already debited and
      // sent; reversing the ledger requires a separate credit entry. Flag for manual review.
      this.logger.warn(
        `payout_refund received for already-settled payout payoutId=${payout.id} merchantTxRef=${merchantTxRef} — manual reconciliation required`,
      );
      return;
    }
    await this.failWithdrawal(payout.id);
  }

  // ─── Query methods ───────────────────────────────────────────────

  async getJournalById(journalId: string): Promise<IResponse> {
    const journal = await this.transactionsDb.findJournalById(journalId);
    if (!journal) {
      throw new NotFoundException('Journal not found');
    }
    return {
      status: 'success',
      statusCode: 200,
      message: 'Journal retrieved',
      data: journal,
    };
  }

  async getJournalsByOrder(orderId: string): Promise<IResponse> {
    const journals = await this.transactionsDb.findJournalsByOrder(orderId);
    return {
      status: 'success',
      statusCode: 200,
      message:
        journals.length > 0
          ? 'Journals retrieved'
          : 'No journals found for this order',
      data: journals,
    };
  }

  async getWalletTransactions(
    walletId: string,
    opts: { offset: number; limit: number; sortOrder: 'ASC' | 'DESC' },
  ): Promise<IResponse> {
    const { entries, count } = await this.transactionsDb.findEntriesByWallet(
      walletId,
      opts,
    );
    return {
      status: 'success',
      statusCode: 200,
      message:
        entries.length > 0 ? 'Transactions retrieved' : 'No transactions found',
      data: entries,
      meta: { count },
    };
  }

  /**
   * Fetch transactions for a business or rider (wallet-based).
   */
  async getMyTransactions(
    auth: ITokenPayload,
    query: TransactionQueryDTO,
  ): Promise<IResponse> {
    try {
      const ownerType =
        auth.userType === UserType.RIDER
          ? WalletOwnerType.RIDER
          : WalletOwnerType.BUSINESS;
      const ownerId =
        auth.userType === UserType.RIDER ? auth.riderId : auth.businessId;

      if (!ownerId) {
        throw new BadRequestException('Owner context is required');
      }

      const wallet = await this.walletDb.findWalletByOwner(ownerType, ownerId);
      if (!wallet) {
        throw new NotFoundException('Wallet not found');
      }

      const { count } = await this.transactionsDb.findEntriesByWallet(
        wallet.id,
        {
          offset: 0,
          limit: 0,
          sortOrder: 'DESC',
          type: query.type,
          orderId: query.orderId,
        },
      );
      const { limit, offset, totalPages } = this.utilService.getPaginationData(
        { page: query.page, limit: query.limit },
        count,
      );

      const { entries } = await this.transactionsDb.findEntriesByWallet(
        wallet.id,
        {
          offset,
          limit,
          sortOrder:
            (query.sortOrder?.toUpperCase() as 'ASC' | 'DESC') || 'DESC',
          type: query.type,
          orderId: query.orderId,
        },
      );

      return {
        status: 'success',
        statusCode: 200,
        message:
          entries.length > 0
            ? 'Transactions retrieved'
            : 'No transactions found',
        data: entries,
        meta: { count, currentPage: query.page || 1, limit, totalPages },
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      this.logger.error('Failed to fetch transactions', error);
      throw new InternalServerErrorException('Failed to fetch transactions');
    }
  }

  /**
   * Request payout (business or rider).
   */
  async requestPayoutForUser(
    auth: ITokenPayload,
    payload: RequestPayoutDTO,
  ): Promise<IResponse> {
    const isRider = auth.userType === UserType.RIDER;
    const walletOwnerType = isRider
      ? WalletOwnerType.RIDER
      : WalletOwnerType.BUSINESS;
    const bankOwnerType = isRider
      ? BankAccountOwnerType.RIDER
      : BankAccountOwnerType.BUSINESS;
    const ownerId = isRider ? auth.riderId : auth.businessId;

    if (!ownerId) {
      throw new BadRequestException('Owner context is required');
    }

    const [wallet, payoutAccount] = await Promise.all([
      this.walletDb.findWalletByOwner(walletOwnerType, ownerId),
      this.accountDb.findBankAccount(ownerId, bankOwnerType),
    ]);

    if (!wallet) throw new NotFoundException('Wallet not found');
    if (!payoutAccount) {
      throw new BadRequestException(
        'No payout account saved. Please add a payout account before requesting a withdrawal.',
      );
    }

    return this.requestWithdrawal({
      walletId: wallet.id,
      amount: payload.amount,
      destination: {
        bankCode: payoutAccount.bankCode,
        accountNumber: payoutAccount.accountNumber,
        accountName: payoutAccount.accountName,
      },
      walletOwnerType,
      metadata: {
        requestedBy: auth.id,
        userType: auth.userType,
      },
    });
  }

  /**
   * Fetch payouts for a business or rider.
   */
  async getMyPayouts(
    auth: ITokenPayload,
    query: PayoutQueryDTO,
  ): Promise<IResponse> {
    const ownerType =
      auth.userType === UserType.RIDER
        ? WalletOwnerType.RIDER
        : WalletOwnerType.BUSINESS;
    const ownerId =
      auth.userType === UserType.RIDER ? auth.riderId : auth.businessId;

    if (!ownerId) {
      throw new BadRequestException('Owner context is required');
    }

    const wallet = await this.walletDb.findWalletByOwner(ownerType, ownerId);
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    const { count } = await this.transactionsDb.findPayoutsByWallet(wallet.id, {
      offset: 0,
      limit: 0,
      sortOrder: 'DESC',
      status: query.status,
    });
    const { limit, offset, totalPages } = this.utilService.getPaginationData(
      { page: query.page, limit: query.limit },
      count,
    );

    const { payouts } = await this.transactionsDb.findPayoutsByWallet(
      wallet.id,
      {
        offset,
        limit,
        sortOrder: (query.sortOrder?.toUpperCase() as 'ASC' | 'DESC') || 'DESC',
        status: query.status,
      },
    );

    return {
      status: 'success',
      statusCode: 200,
      message: payouts.length > 0 ? 'Payouts retrieved' : 'No payouts found',
      data: payouts,
      meta: { count, currentPage: query.page || 1, limit, totalPages },
    };
  }

  /**
   * Fetch a single payout by ID (scoped to the user's wallet).
   */
  async getPayoutById(
    payoutId: string,
    auth: ITokenPayload,
  ): Promise<IResponse> {
    const payout = await this.transactionsDb.findPayoutById(payoutId);
    if (!payout) {
      throw new NotFoundException('Payout not found');
    }

    // Verify ownership via wallet
    const ownerType =
      auth.userType === UserType.RIDER
        ? WalletOwnerType.RIDER
        : WalletOwnerType.BUSINESS;
    const ownerId =
      auth.userType === UserType.RIDER ? auth.riderId : auth.businessId;

    const wallet = await this.walletDb.findWalletByOwner(ownerType, ownerId!);
    if (!wallet?.id || payout.walletId !== wallet.id) {
      throw new NotFoundException('Payout not found');
    }

    return {
      status: 'success',
      statusCode: 200,
      message: 'Payout retrieved',
      data: payout,
    };
  }

  /**
   * Save webhook response payload on a journal.
   * Looks up the journal by reference or orderId.
   */
  async saveWebhookMeta(opts: {
    reference?: string;
    orderId?: string;
    journalId?: string;
    webhookMeta: Record<string, any>;
  }): Promise<IResponse> {
    let journal: LedgerJournal | null = null;

    if (opts.journalId) {
      journal = await this.transactionsDb.findJournalById(opts.journalId);
    } else if (opts.reference) {
      journal = await this.transactionsDb.findJournalByReference(
        opts.reference,
      );
    } else if (opts.orderId) {
      journal = await this.transactionsDb.findJournalByOrderId(opts.orderId);
    }

    if (!journal) {
      throw new NotFoundException('Journal not found');
    }

    await this.transactionsDb.saveWebhookMeta(journal.id, opts.webhookMeta);

    return {
      status: 'success',
      statusCode: 200,
      message: 'Webhook meta saved',
      data: { journalId: journal.id },
    };
  }

  /**
   * Reconciliation: compares cached wallet balance against ledger-computed balance.
   */
  async reconcileWallet(walletId: string): Promise<IResponse> {
    const wallet = await this.walletDb.findWalletById(walletId);
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    const computedBalance =
      await this.transactionsDb.computeWalletBalance(walletId);
    const drift = wallet.balance - computedBalance;

    return {
      status: 'success',
      statusCode: 200,
      message: drift === 0 ? 'Wallet is balanced' : 'Balance drift detected',
      data: {
        walletId,
        cachedBalance: wallet.balance,
        computedBalance,
        drift,
      },
    };
  }
}
