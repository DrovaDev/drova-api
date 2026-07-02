import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  JoinColumn,
  OneToMany,
  ManyToOne,
  OneToOne,
} from 'typeorm';
import type { Point } from 'typeorm';
import {
  AvailabilityStatus,
  VehicleType,
  RiderStatus,
  InviteStatus,
} from 'src/constants';
import { Auth } from 'src/api/authentication/schemas/auth.schema';
import { Business } from 'src/api/business/schemas/business.schema';
import { Orders } from 'src/api/order/schemas/order.schema';

@Entity()
@Index(['id'])
@Index(['authId'], { unique: true })
@Index(['businessId'])
@Index(['firstName', 'lastName'])
export class Rider {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    nullable: false,
    type: 'uuid',
    unique: true,
  })
  authId: string;

  @Column({
    nullable: false,
    type: 'uuid',
  })
  businessId: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  firstName?: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  lastName?: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  otherName?: string;

  @Column({
    type: 'varchar',
    length: 20,
    nullable: false,
  })
  phoneNumber: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  profilePhoto?: string;

  @Column({
    type: 'enum',
    enum: VehicleType,
    nullable: true,
  })
  vehicleType?: VehicleType;

  @Column({
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  vehiclePlateNumber?: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  vehicleModel?: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  vehicleColor?: string;

  @Column({
    type: 'enum',
    enum: RiderStatus,
    default: RiderStatus.PENDING,
    nullable: false,
  })
  status: RiderStatus;

  @Column({
    type: 'boolean',
    default: false,
    nullable: false,
  })
  isDeleted: boolean;

  @Column({
    nullable: false,
    default: false,
    type: 'boolean',
  })
  hasChangedPassword: boolean;

  @Column({
    type: 'enum',
    enum: InviteStatus,
    default: InviteStatus.PENDING,
    nullable: false,
  })
  inviteStatus: InviteStatus;

  @Column({
    type: 'enum',
    enum: AvailabilityStatus,
    default: AvailabilityStatus.OFFLINE,
    nullable: false,
  })
  availabilityStatus: AvailabilityStatus;

  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  lastKnownLocation?: Point;

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  lastLocationUpdatedAt?: Date;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  activeDeviceId?: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  sessionId?: string;

  @OneToOne(() => Auth, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'authId' })
  auth: Auth;

  @ManyToOne(() => Business, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'businessId' })
  business: Business;

  @OneToMany(() => Orders, (order) => order.rider)
  orders: Orders[];

  @CreateDateColumn({
    type: 'timestamptz',
  })
  createdAt: Date;

  @UpdateDateColumn({
    type: 'timestamptz',
  })
  updatedAt: Date;
}
