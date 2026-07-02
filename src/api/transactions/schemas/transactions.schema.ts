import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { JournalType, JournalStatus } from 'src/constants';
import { Orders } from 'src/api/order/schemas/order.schema';
import { LedgerEntry } from './transaction-entries.schema';

@Entity('ledger_journal')
@Index(['reference'], { unique: true })
@Index(['orderId'])
@Index(['type'])
@Index(['status'])
@Index(['createdAt'])
export class LedgerJournal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: false,
    unique: true,
  })
  reference: string;

  @Column({
    type: 'enum',
    enum: JournalType,
    nullable: false,
  })
  type: JournalType;

  @Column({
    type: 'enum',
    enum: JournalStatus,
    nullable: false,
    default: JournalStatus.PENDING,
  })
  status: JournalStatus;

  @Column({ type: 'uuid', nullable: true })
  orderId?: string;

  @Column({ type: 'uuid', nullable: true })
  reversalOfId?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  webhookMeta?: Record<string, any>;

  @Column({ type: 'timestamptz', nullable: true })
  postedAt?: Date;

  @ManyToOne(() => Orders, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'orderId' })
  order?: Orders;

  @ManyToOne(() => LedgerJournal, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reversalOfId' })
  reversalOf?: LedgerJournal;

  @OneToMany(() => LedgerEntry, (entry) => entry.journal, { cascade: true })
  entries: LedgerEntry[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
