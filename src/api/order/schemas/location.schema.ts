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
import type { Point } from 'geojson';
import { NigerianState } from 'src/constants';
import { Orders } from './order.schema';

@Entity()
@Index(['orderId'], { unique: true })
export class OrderLocations {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false, unique: true })
  orderId: string;

  @Column({ type: 'varchar', length: 500, nullable: false })
  pickupAddress: string;

  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: false,
  })
  pickupCoordinates: Point;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  pickupCity?: string;

  @Column({
    type: 'enum',
    enum: NigerianState,
    nullable: false,
  })
  pickupState: NigerianState;

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  pickupNearestLandmark?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  pickupContactPersonName?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  pickupContactPersonPhone?: string;

  @Column({ type: 'varchar', length: 500, nullable: false })
  deliveryAddress: string;

  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: false,
  })
  deliveryCoordinates: Point;

  @Column({ type: 'enum', enum: NigerianState, nullable: false })
  deliveryState: NigerianState;

  @Column({ type: 'varchar', length: 500, nullable: true })
  deliveryNearestLandmark: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @OneToOne(() => Orders, (order) => order.locations, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'orderId' })
  order: Orders;
}
