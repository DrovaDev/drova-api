import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
  BeforeUpdate,
  Index,
  OneToOne,
  OneToMany,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { UserType } from 'src/constants';
import { Business } from 'src/api/business/schemas/business.schema';
import { DeviceTokens } from 'src/api/notification/schemas/token.schema';

@Entity()
@Index(['id', 'email'])
export class Auth {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    unique: true,
    nullable: true,
    length: 255,
    type: 'varchar',
  })
  email?: string;

  @Column({
    unique: true,
    nullable: true,
    length: 255,
    type: 'varchar',
  })
  telephoneNumber?: string;

  @Column({
    nullable: true,
    length: 255,
    type: 'varchar',
  })
  @Exclude()
  password?: string;

  @Column({
    nullable: false,
    type: 'enum',
    enum: UserType,
  })
  userType!: UserType;

  @Column({
    nullable: false,
    default: false,
    type: 'boolean',
  })
  isActive!: boolean;

  @Column({
    nullable: false,
    default: false,
    type: 'boolean',
  })
  isVerified!: boolean;

  @Column({
    nullable: false,
    default: false,
    type: 'boolean',
  })
  isSuspended!: boolean;

  @Column({
    nullable: false,
    default: false,
    type: 'boolean',
  })
  isDeleted!: boolean;

  @Column({
    nullable: true,
    type: 'boolean',
  })
  hasCompletedBusinessProfile!: boolean;

  @CreateDateColumn({
    type: 'timestamptz',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    type: 'timestamptz',
  })
  updatedAt!: Date;

  @OneToOne(() => Business, (business) => business.auth)
  business: Business;

  @OneToMany(() => DeviceTokens, (deviceToken) => deviceToken.user)
  deviceTokens: DeviceTokens[];

  @BeforeInsert()
  @BeforeUpdate()
  normalizeEmail() {
    if (this.email) {
      this.email = this.email.toLowerCase().trim();
    }
  }
}
