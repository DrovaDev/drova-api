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
}
