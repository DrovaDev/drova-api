import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { AxiosError } from 'axios';
import { NombaService } from 'src/services/nomba.service';
import { TransactionsDb } from '../transactions.db';
import { PayoutStatus } from 'src/constants';
import {
  PAYOUTS_QUEUE,
  PROCESS_PAYOUT_JOB,
  type ProcessPayoutJobData,
} from './payouts.queue.constants';

@Processor(PAYOUTS_QUEUE)
export class PayoutsQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(PayoutsQueueProcessor.name);

  constructor(
    private readonly nombaService: NombaService,
    private readonly transactionsDb: TransactionsDb,
  ) {
    super();
  }

  async process(job: Job<ProcessPayoutJobData>) {
    if (job.name !== PROCESS_PAYOUT_JOB) {
      this.logger.warn(`Unhandled job name: ${job.name}`);
      return;
    }

    const { payoutId } = job.data;

    const payout = await this.transactionsDb.findPayoutById(payoutId);
    if (!payout) {
      this.logger.error(`Payout not found payoutId=${payoutId}`);
      return;
    }

    // Skip if the payout has already been settled (idempotent guard)
    if (
      payout.status === PayoutStatus.SUCCESS ||
      payout.status === PayoutStatus.FAILED ||
      payout.status === PayoutStatus.CANCELED
    ) {
      this.logger.log(
        `Payout already settled, skipping transfer payoutId=${payoutId} status=${payout.status}`,
      );
      return;
    }

    await this.transactionsDb.updatePayoutStatus(payoutId, PayoutStatus.PROCESSING);

    try {
      const result = await this.nombaService.transferToBank({
        amount: payout.amount,
        bankCode: payout.destination.bankCode,
        accountNumber: payout.destination.accountNumber,
        accountName: payout.destination.accountName,
        merchantTxRef: payout.idempotencyKey,
        narration: 'Drova earnings payout',
      });

    
      const providerReference = String(
        (result as Record<string, any>)?.id ??
          (result as Record<string, any>)?.transactionReference ??
          (result as Record<string, any>)?.reference ??
          '',
      );
      if (providerReference) {
        await this.transactionsDb.updatePayoutStatus(
          payoutId,
          PayoutStatus.PROCESSING,
          providerReference,
        );
      }

      this.logger.log(
        `Transfer initiated payoutId=${payoutId} idempotencyKey=${payout.idempotencyKey} providerRef=${providerReference}`,
      );
    } catch (error) {
      const isPermanent = this.isPermanentError(error as AxiosError);
      this.logger.error(
        `Transfer failed payoutId=${payoutId} permanent=${isPermanent}`,
        error,
      );

      if (isPermanent) {
        // Fail the journal immediately so the ledger hold is released
        await this.transactionsDb.updatePayoutStatus(payoutId, PayoutStatus.FAILED);
        if (payout.journalId) {
          await this.transactionsDb.failJournal(payout.journalId);
        }
        return;
      }

      throw error; 
    }
  }

  private isPermanentError(error: AxiosError): boolean {
    const status = error?.response?.status;
    return typeof status === 'number' && status >= 400 && status < 500;
  }
}
