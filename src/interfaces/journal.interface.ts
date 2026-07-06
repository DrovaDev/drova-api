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
  /**
   * Which wallet balance field(s) to update.
   *
   * createJournal (PENDING):     default 'ledgerBalance'
   * createAndPostJournal (POSTED): default 'both'
   *
   * - 'ledgerBalance' — only update ledgerBalance (escrow tracking)
   * - 'balance'       — only update available balance
   * - 'both'          — update both fields
   */
  balanceField?: 'ledgerBalance' | 'balance' | 'both';
  /**
   * Direct ledgerBalance adjustments applied inside the same DB transaction.
   * Used by settleOrder to atomically release the escrow counter when crediting
   * the available balance. Not subject to the double-entry balance check.
   * Positive delta = credit (increase), negative delta = debit (decrease).
   */
  ledgerBalanceAdjustments?: Array<{ walletId: string; delta: number }>;
}
