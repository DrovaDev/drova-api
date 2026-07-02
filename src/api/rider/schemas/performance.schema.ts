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
  PackageType,
  NigerianState,
  BusinessOperatingHour,
} from 'src/constants';
import { Rider } from './rider.schema';

@Entity()
@Index(['id'])
@Index(['riderId'], { unique: true })
export class RiderPerformance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    nullable: false,
    type: 'uuid',
  })
  riderId: string;

  @Column({
    type: 'int',
    default: 0,
    nullable: false,
  })
  totalDeliveries: number;

  @Column({
    type: 'int',
    default: 0,
    nullable: false,
  })
  totalCancellations: number;

  @Column({
    type: 'numeric',
    precision: 5,
    scale: 2,
    default: 0,
    nullable: false,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  averageRating: number;

  @Column({ type: 'int', default: 0, nullable: false })
  totalReviews: number;

  @OneToOne(() => Rider, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'riderId' })
  rider: Rider;

  @CreateDateColumn({
    type: 'timestamptz',
  })
  createdAt: Date;

  @UpdateDateColumn({
    type: 'timestamptz',
  })
  updatedAt: Date;

  // @Column({
  //     type: 'numeric',
  //     precision: 5,
  //     scale: 2,
  //     default: 0,
  //     nullable: false,
  //     transformer: {
  //       to: (value: number) => value,
  //       from: (value: string) => parseFloat(value),
  //     },
  // })
  // onTimePercentage: number;            // % of deliveries completed within estimated time

  // @Column({ type: 'int', default: 0, nullable: false })
  // totalDisputes: number;
}
