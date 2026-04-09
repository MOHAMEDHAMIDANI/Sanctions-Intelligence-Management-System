import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RoleEnum } from '../../common/enums/role.enum';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  phone: string;

  @Column({
    type: 'enum',
    enum: RoleEnum,
    default: RoleEnum.COMPLIANCE,
  })
  role: RoleEnum;

  @Column({ default: false })
  isConfirmed: boolean;

  @Column({ nullable: true, select: false })
  inviteToken: string;

  @Column({ type: 'timestamp', nullable: true, select: false })
  inviteTokenExpiry: Date;

  @Column({ nullable: true, select: false })
  otpCode: string;

  @Column({ type: 'timestamp', nullable: true, select: false })
  otpExpiry: Date;

  @Column({ type: 'int', default: 0, select: false })
  otpAttemptCount: number;

  @Column({ type: 'timestamp', nullable: true, select: false })
  otpLockedUntil?: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
