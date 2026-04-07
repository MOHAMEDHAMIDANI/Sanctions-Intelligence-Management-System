import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { WebhookFormatEnum } from '../enums/webhook-format.enum';
import { WebhookDelivery } from './webhook-delivery.entity';

@Entity('webhook_targets')
export class WebhookTarget {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text' })
  url: string;

  @Column({
    type: 'enum',
    enum: WebhookFormatEnum,
    default: WebhookFormatEnum.JSON,
  })
  format: WebhookFormatEnum;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'text', nullable: true })
  secretKey?: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', nullable: true })
  mapping?: Record<string, string> | null;

  @Column({ type: 'text', array: true, default: '{}' })
  eventTypes: string[];

  @OneToMany(() => WebhookDelivery, (delivery) => delivery.target)
  deliveries: WebhookDelivery[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
