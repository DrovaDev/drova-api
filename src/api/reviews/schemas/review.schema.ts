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
import { ReviewTargetType } from 'src/constants';
import { Orders } from 'src/api/order/schemas/order.schema';

@Entity('reviews')
@Index(['orderId', 'targetType'], { unique: true })
@Index(['targetId', 'targetType'])
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  orderId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  guestEmail?: string;

  @Column({ type: 'enum', enum: ReviewTargetType })
  targetType: ReviewTargetType;

  @Column({ type: 'uuid' })
  targetId: string;

  @Column({ type: 'smallint' })
  rating: number;

  @Column({ type: 'text', nullable: true })
  comment?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => Orders, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'orderId' })
  order: Orders;
}
