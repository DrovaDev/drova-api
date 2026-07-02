// order-item.schema.ts
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
import { PackageType } from 'src/constants';
import { Orders } from './order.schema';

@Entity()
@Index(['orderId'])
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  orderId: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  packageName: string;

  @Column({ type: 'text', nullable: true })
  packageDescription: string | null;

  @Column({
    type: 'enum',
    enum: PackageType,
    nullable: false,
  })
  packageType: PackageType;

  @Column({ type: 'int', nullable: false, default: 1 })
  quantity: number;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    nullable: false,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => Number.parseFloat(value),
    },
  })
  estimatedValue: number;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 3,
    nullable: true,
    transformer: {
      to: (value: number | null) => value,
      from: (value: string | null) =>
        value === null ? null : Number.parseFloat(value),
    },
  })
  estimatedWeight: number | null;

  @Column({ type: 'text', nullable: true })
  specialInstructions: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => Orders, (order) => order.items, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'orderId' })
  order: Orders;
}
