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
      from: (value: string) => parseFloat(value),
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
      from: (value: string) => parseFloat(value),
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

  @CreateDateColumn({
    type: 'timestamptz',
  })
  createdAt: Date;

  @UpdateDateColumn({
    type: 'timestamptz',
  })
  updatedAt: Date;
}
