import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity()
@Index(['authId', 'isRead'])
@Index(['authId', 'createdAt'])
export class InAppNotification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  authId: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  type: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  title: string;

  @Column({ type: 'text', nullable: false })
  body: string;

  @Column({ type: 'jsonb', nullable: true })
  data?: Record<string, string>;

  @Column({ type: 'boolean', default: false, nullable: false })
  isRead: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
