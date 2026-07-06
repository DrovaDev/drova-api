import { JournalType, LedgerEntryDirection } from 'src/constants';
export interface CreateEntryInput {
  walletId: string;
  direction: LedgerEntryDirection;
  amount: number;
  currency?: string;
}

export interface CreateJournalInput {
  reference: string;
  type: JournalType;
  orderId?: string;
  reversalOfId?: string;
  metadata?: Record<string, any>;
  entries: CreateEntryInput[];
  /** Which wallet balance field to update at creation time. Defaults to
   * 'ledgerBalance' (escrow/in-flight). Use 'balance' for withdrawals so that
   * available balance is reserved immediately without touching ledgerBalance. */
  balanceField?: 'ledgerBalance' | 'balance';
}
