import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { LedgerEntryDirection } from 'src/constants';
import { LedgerJournal } from './transactions.schema';
import { Wallet } from 'src/api/wallets/schemas/wallet.schema';

@Entity('ledger_entry')
@Index(['journalId'])
@Index(['walletId'])
@Index(['walletId', 'journalId'])
export class LedgerEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  journalId: string;

  @Column({ type: 'uuid', nullable: false })
  walletId: string;

  @Column({
    type: 'enum',
    enum: LedgerEntryDirection,
    nullable: false,
  })
  direction: LedgerEntryDirection;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    nullable: false,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  amount: number;

  @Column({
    type: 'varchar',
    length: 3,
    nullable: false,
    default: 'NGN',
  })
  currency: string;

  @ManyToOne(() => LedgerJournal, (journal) => journal.entries, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'journalId' })
  journal: LedgerJournal;

  @ManyToOne(() => Wallet, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'walletId' })
  wallet: Wallet;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
