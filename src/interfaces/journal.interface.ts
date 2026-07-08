import { JournalType, LedgerEntryDirection } from 'src/constants';
export interface CreateEntryInput {
  walletId: string;
  direction: LedgerEntryDirection;
  amount: number;
  currency?: string;
  /** Override the journal-level balanceField for this specific entry. */
  balanceField?: 'balance' | 'ledgerBalance' | 'both';
}

export interface CreateJournalInput {
  reference: string;
  type: JournalType;
  orderId?: string;
  reversalOfId?: string;
  metadata?: Record<string, any>;
  entries: CreateEntryInput[];
  balanceField?: 'ledgerBalance' | 'balance' | 'both';
  
  ledgerBalanceAdjustments?: Array<{ walletId: string; delta: number }>;
}
