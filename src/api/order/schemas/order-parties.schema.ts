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

@Entity()
@Index(['orderId'], { unique: true })
export class OrderParties {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'uuid',
    nullable: false,
    unique: true,
  })
  orderId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  guestFullName: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  guestContactNumber?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  guestEmail?: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  recipientFullName: string;

  @Column({ type: 'varchar', length: 20, nullable: false })
  recipientContactNumber: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  recipientEmail?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @OneToOne(() => Orders, (order) => order.parties, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'orderId' })
  order: Orders;
}
