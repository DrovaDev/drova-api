import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  JoinColumn,
  OneToMany,
  OneToOne,
} from 'typeorm';
import type { Point } from 'typeorm';
import {
  DeliveryScope,
  NigerianState,
  BusinessOperatingHour,
} from 'src/constants';
import { Auth } from 'src/api/authentication/schemas/auth.schema';
import { Rider } from 'src/api/rider/schemas/rider.schema';
import { Wallet } from 'src/api/wallets/schemas/wallet.schema';
import { Orders } from 'src/api/order/schemas/order.schema';

@Entity()
@Index(['businessName', 'businessState'])
export class Business {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    nullable: false,
    type: 'uuid',
  })
  authId!: string;

  @Column({
    nullable: false,
    default: true,
    type: 'boolean',
  })
  isVerified!: boolean;

  @Column({
    nullable: false,
    length: 255,
    type: 'varchar',
  })
  businessName!: string;

  @Column({
    nullable: true,
    type: 'text',
  })
  businessDescription?: string;

  @Column({
    nullable: false,
    length: 255,
    type: 'varchar',
  })
  businessAddress!: string;

  @Column({
    nullable: false,
    type: 'enum',
    enum: NigerianState,
  })
  businessState!: NigerianState;

  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: false,
  })
  location!: Point;

  @Column({
    nullable: false,
    type: 'enum',
    array: true,
    enum: DeliveryScope,
  })
  deliveryScope!: DeliveryScope[];

  @Column({
    nullable: false,
    type: 'int',
    default: 0,
  })
  fleetSize!: number;

  @Column({
    nullable: true,
    type: 'varchar',
    length: 255,
    unique: true,
  })
  businessRegistrationNumber?: string;

  @Column({
    nullable: true,
    type: 'varchar',
    length: 255,
    unique: true,
  })
  taxIdentificationNumber?: string;

  @Column({
    nullable: true,
    type: 'varchar',
    length: 255,
    unique: true,
  })
  bvn?: string;

  @Column({
    nullable: false,
    length: 255,
    type: 'varchar',
  })
  contactNumber!: string;

  @Column({
    nullable: true,
    length: 255,
    type: 'varchar',
  })
  businessLogo?: string;

  @Column({
    nullable: true,
    type: 'varchar',
    length: 255,
  })
  coverImage?: string;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: false,
    unique: true,
  })
  slug!: string;

  @Column({
    nullable: true,
    type: 'jsonb',
  })
  operatingHours?: BusinessOperatingHour[];

  @OneToOne(() => Wallet, {
    nullable: true,
    eager: false,
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'id', referencedColumnName: 'ownerId' })
  wallet?: Wallet;

  @OneToOne(() => Auth, (auth) => auth.business, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'authId' })
  auth!: Auth;

  @OneToMany(() => Rider, (rider) => rider.business)
  riders?: Rider[];

  @OneToMany(() => Orders, (order) => order.business)
  orders?: Orders[];

  @CreateDateColumn({
    type: 'timestamptz',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    type: 'timestamptz',
  })
  updatedAt!: Date;
}
