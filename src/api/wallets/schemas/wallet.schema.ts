import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { WalletOwnerType, WalletStatus, WalletProvider } from 'src/constants';

@Entity()
@Index(['ownerType', 'ownerId'], { unique: true })
@Index(['ownerId'])
export class Wallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    nullable: false,
    type: 'enum',
    enum: WalletOwnerType,
  })
  ownerType: WalletOwnerType;

  @Column({
    nullable: false,
    type: 'uuid',
  })
  ownerId: string;

  @Column({
    nullable: false,
    type: 'varchar',
    length: 3,
    default: 'NGN',
  })
  currency: string;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
    nullable: false,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => Number.parseFloat(value),
    },
  })
  balance: number;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
    nullable: false,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => Number.parseFloat(value),
    },
  })
  ledgerBalance: number;

  @Column({
    nullable: false,
    type: 'enum',
    enum: WalletStatus,
    default: WalletStatus.ACTIVE,
  })
  status: WalletStatus;

  @Column({
    nullable: false,
    type: 'enum',
    enum: WalletProvider,
    default: WalletProvider.DROVA,
  })
  provider: WalletProvider;

  /** Bcrypt hash of the withdrawal PIN — never returned in queries (select: false). */
  @Column({ type: 'varchar', nullable: true, select: false })
  withdrawalPin?: string;

  /** Indicates to the frontend whether a withdrawal PIN has been set. */
  @Column({ type: 'boolean', default: false, nullable: false })
  hasWithdrawalPin: boolean = false;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
