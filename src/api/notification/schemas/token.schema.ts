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
import { Auth } from 'src/api/authentication/schemas/auth.schema';

@Entity()
@Index(['id'])
@Index(['authId'])
@Index(['authId', 'deviceId'])
@Index(['deviceToken'], { unique: true })
export class DeviceTokens {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  deviceId?: string;

  @Column({
    nullable: false,
    type: 'text',
  })
  deviceToken: string;

  @Column({
    type: 'boolean',
    default: true,
    nullable: false,
  })
  isActive: boolean;

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  lastSeenAt?: Date | null;

  @Column({
    type: 'uuid',
    nullable: false,
    name: 'authId',
  })
  authId: string;

  @ManyToOne(() => Auth, (user) => user.deviceTokens, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'authId' })
  user: Auth;

  @CreateDateColumn({
    type: 'timestamptz',
  })
  createdAt: Date;

  @UpdateDateColumn({
    type: 'timestamptz',
  })
  updatedAt: Date;
}
