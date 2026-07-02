import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Orders } from './order.schema';
import { CancelledBy } from 'src/constants';

@Entity()
@Index(['orderId'], { unique: true })
export class OrderTracking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false, unique: true })
  orderId: string;

  @Column({ type: 'timestamptz', nullable: true })
  confirmedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  assignedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  enRoutePickupAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  pickedUpAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  inTransitAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  arrivedAtDeliveryAt: Date | null = null;

  @Column({ type: 'timestamptz', nullable: true })
  deliveredAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  cancellationReason: string | null;

  @Column({
    type: 'enum',
    enum: CancelledBy,
    nullable: true,
  })
  cancelledBy: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @OneToOne(() => Orders, (order) => order.tracking, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'orderId' })
  order: Orders;
}
