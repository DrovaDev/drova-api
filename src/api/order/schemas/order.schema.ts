import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToOne,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import {
  OrderStatus,
  PickupMethod,
  DeliveryPriority,
  PaymentStatus,
  CancelledBy,
} from 'src/constants';
import { Exclude } from 'class-transformer';
import { Business } from 'src/api/business/schemas/business.schema';
import { Rider } from 'src/api/rider/schemas/rider.schema';
import { OrderItem } from './items.schema';
import { OrderParties } from './order-parties.schema';
import { OrderLocations } from './location.schema';
import { OrderTracking } from './tracking.schema';

@Entity()
@Index(['businessId'])
@Index(['riderId'])
@Index(['status'])
@Index(['referenceCode'], { unique: true })
@Index(['businessId', 'status'])
@Index(['createdAt'])
export class Orders {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'varchar',
    length: 20,
    nullable: false,
    unique: true,
  })
  referenceCode: string;

  @Column({
    type: 'uuid',
    nullable: false,
  })
  businessId: string;

  @Column({ type: 'uuid', nullable: true })
  riderId?: string;


  @Column({
    type: 'enum',
    enum: OrderStatus,
    nullable: false,
    default: OrderStatus.PENDING,
  })
  status: OrderStatus;

  @Column({
    type: 'enum',
    enum: PickupMethod,
    nullable: false,
    default: PickupMethod.BUSINESS_PICKUP,
  })
  pickupMethod: PickupMethod;

  @Column({
    type: 'enum',
    enum: DeliveryPriority,
    nullable: false,
    default: DeliveryPriority.EXPRESS,
  })
  deliveryPriority: DeliveryPriority;

  @Column({ type: 'timestamptz', nullable: true })
  prefferedDeliveryTime?: Date;

  @Column({ type: 'text', nullable: true })
  customerNote?: string;

  @Column({ type: 'text', nullable: true })
  pickupInstructions?: string;

  @Column({ type: 'text', nullable: true })
  deliveryInstructions?: string;

  @Column({ type: 'varchar', length: 6, nullable: true })
  @Exclude()
  deliveryPin?: string;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    nullable: false,
    default: 0,
    transformer: {
      to: (v: number) => v,
      from: (v: string) => Number.parseFloat(v),
    },
  })
  deliveryFee: number;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    nullable: false,
    default: 0,
    transformer: {
      to: (v: number) => v,
      from: (v: string) => Number.parseFloat(v),
    },
  })
  pickupFee: number;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    nullable: false,
    default: 0,
    transformer: {
      to: (v: number) => v,
      from: (v: string) => Number.parseFloat(v),
    },
  })
  packagingFee: number;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    nullable: false,
    default: 0,
    transformer: {
      to: (v: number) => v,
      from: (v: string) => Number.parseFloat(v),
    },
  })
  serviceFee: number;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    nullable: false,
    default: 0,
    transformer: {
      to: (v: number) => v,
      from: (v: string) => Number.parseFloat(v),
    },
  })
  platformCommission: number;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    nullable: false,
    default: 0,
    transformer: {
      to: (v: number) => v,
      from: (v: string) => parseFloat(v),
    },
  })
  businessPayout: number;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    nullable: false,
    default: PaymentStatus.PENDING,
  })
  paymentStatus: PaymentStatus;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  paymentReference?: string;

  @Column({
    type: 'varchar',
    length: 2000,
    nullable: true,
  })
  paymentLink?: string;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    nullable: true,
    transformer: {
      to: (v: number | null) => v,
      from: (v: string | null) => (v === null ? null : Number.parseFloat(v)),
    },
  })
  totalAmount?: number;

  @Column({ type: 'jsonb', nullable: true })
  priceBreakdown?: Record<string, any>;

  @Column({ type: 'timestamptz', nullable: true })
  invoiceSentAt?: Date;

  @Column({ type: 'boolean', default: false, nullable: false })
  isDeleted: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  offerExpiresAt?: Date;

  @Column({ type: 'enum', enum: CancelledBy, nullable: true })
  cancelledBy?: CancelledBy;

  @Column({ type: 'timestamptz', nullable: true })
  cancelledAt?: Date;

  @Column({ type: 'text', nullable: true })
  cancellationReason?: string;

  @Column({ type: 'timestamptz', nullable: true })
  paidAt?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  escrowHeldAt?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  escrowReleasedAt?: Date;

  @ManyToOne(() => Business, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'businessId' })
  business: Business;

  @ManyToOne(() => Rider, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'riderId' })
  rider?: Rider;


  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items: OrderItem[];

  @OneToOne(() => OrderParties, (parties) => parties.order, { cascade: true })
  parties: OrderParties;

  @OneToOne(() => OrderLocations, (locations) => locations.order, {
    cascade: true,
  })
  locations: OrderLocations;

  @OneToOne(() => OrderTracking, (tracking) => tracking.order, {
    cascade: true,
  })
  tracking: OrderTracking;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
