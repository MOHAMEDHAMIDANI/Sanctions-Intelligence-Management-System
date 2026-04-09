import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { WebhookDeliveryStatusEnum } from '../enums/webhook-delivery-status.enum';
import { WebhookTarget } from './webhook-target.entity';

@Entity('webhook_deliveries')
export class WebhookDelivery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_webhook_deliveries_batchId')
  @Column({ type: 'uuid' })
  batchId: string;

  @Index('IDX_webhook_deliveries_targetId')
  @Column({ type: 'uuid', nullable: true })
  targetId?: string | null;

  @ManyToOne(() => WebhookTarget, (target) => target.deliveries, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'targetId' })
  target?: WebhookTarget | null;

  @Column({ type: 'text', nullable: true })
  targetName?: string | null;

  @Column({ type: 'text', nullable: true })
  targetFormat?: string | null;

  @Column({ type: 'text' })
  eventType: string;

  @Column({
    type: 'enum',
    enum: WebhookDeliveryStatusEnum,
    default: WebhookDeliveryStatusEnum.PENDING,
  })
  status: WebhookDeliveryStatusEnum;

  @Column({ type: 'jsonb', nullable: true })
  payload?: any;

  @Column({ type: 'jsonb', nullable: true })
  responseBody?: any;

  @Column({ type: 'int', nullable: true })
  responseStatus?: number | null;

  @Column({ type: 'int', default: 1 })
  attemptCount: number;

  @Column({ type: 'int', nullable: true })
  durationMs?: number | null;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string | null;

  @Index('IDX_webhook_deliveries_attemptedAt')
  @CreateDateColumn()
  attemptedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
