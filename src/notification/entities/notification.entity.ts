import {
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_notifications_userId')
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ nullable: true })
  link?: string;

  @Column({ default: false })
  isRead: boolean;

  @Index('IDX_notifications_createdAt')
  @CreateDateColumn()
  createdAt: Date;
}
