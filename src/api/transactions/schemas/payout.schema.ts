import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PayoutStatus, PayoutProvider } from 'src/constants';
import { Wallet } from 'src/api/wallets/schemas/wallet.schema';
import { LedgerJournal } from './transactions.schema';

@Entity('payout')
@Index(['walletId'])
@Index(['status'])
@Index(['idempotencyKey'], { unique: true })
export class Payout {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  walletId: string;

  @Column({ type: 'uuid', nullable: true })
  journalId?: string;

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

  @Column({ type: 'jsonb', nullable: false })
  destination: {
    bankCode: string;
    accountNumber: string;
    accountName: string;
  };

  @Column({
    type: 'enum',
    enum: PayoutStatus,
    nullable: false,
    default: PayoutStatus.REQUESTED,
  })
  status: PayoutStatus;

  @Column({
    type: 'enum',
    enum: PayoutProvider,
    nullable: false,
    default: PayoutProvider.NOMBA,
  })
  provider: PayoutProvider;

  @Column({ type: 'varchar', length: 255, nullable: true })
  providerReference?: string;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: false,
    unique: true,
  })
  idempotencyKey: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @ManyToOne(() => Wallet, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'walletId' })
  wallet: Wallet;

  @ManyToOne(() => LedgerJournal, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'journalId' })
  journal?: LedgerJournal;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
