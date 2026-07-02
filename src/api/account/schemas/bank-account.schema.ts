import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum BankAccountOwnerType {
  RIDER = 'RIDER',
  BUSINESS = 'BUSINESS',
}

@Entity('bank_accounts')
@Index(['ownerId', 'ownerType'], { unique: true })
export class BankAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  ownerId: string;

  @Column({
    type: 'enum',
    enum: BankAccountOwnerType,
  })
  ownerType: BankAccountOwnerType;

  @Column({ type: 'varchar', length: 20 })
  bankCode: string;

  @Column({ type: 'varchar', length: 100 })
  bankName: string;

  @Column({ type: 'varchar', length: 20 })
  accountNumber: string;

  @Column({ type: 'varchar', length: 255 })
  accountName: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
