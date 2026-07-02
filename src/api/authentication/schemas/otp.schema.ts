import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Auth } from './auth.schema';

@Entity()
export class Otp {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'varchar',
    length: 6,
    nullable: false,
  })
  otpCode: string;

  @Column({
    type: 'timestamptz',
    nullable: false,
  })
  expiresAt: Date;

  @Column({
    type: 'boolean',
    default: false,
    nullable: false,
  })
  isUsed: boolean;

  @Column({
    type: 'uuid',
    nullable: false,
  })
  authId: string;

  @OneToOne(() => Auth, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'authId' })
  userAuth: Auth;

  @CreateDateColumn({
    type: 'timestamptz',
  })
  createdAt: Date;

  @UpdateDateColumn({
    type: 'timestamptz',
  })
  updatedAt: Date;
}
