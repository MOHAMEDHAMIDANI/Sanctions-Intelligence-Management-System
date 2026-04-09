import {
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { ReviewDecisionEnum } from '../../common/enums/review-decision.enum';
import { SanctionedEntity } from '../../sanctioned-entity/entities/sanctioned-entity.entity';
import { User } from '../../user/entities/user.entity';

@Entity('reviews')
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_reviews_sanctionedEntityId')
  @Column({ type: 'uuid' })
  sanctionedEntityId: string;

  @ManyToOne(
    () => SanctionedEntity,
    (sanctionedEntity) => sanctionedEntity.reviews,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'sanctionedEntityId' })
  sanctionedEntity: SanctionedEntity;

  @Index('IDX_reviews_reviewerId')
  @Column({ type: 'uuid' })
  reviewerId: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reviewerId' })
  reviewer: User;

  @Index('IDX_reviews_decision')
  @Column({
    type: 'enum',
    enum: ReviewDecisionEnum,
  })
  decision: ReviewDecisionEnum;

  @Column({ type: 'text', nullable: true })
  comment?: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
