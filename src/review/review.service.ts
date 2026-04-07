import { Injectable, NotFoundException } from '@nestjs/common';
import { ReviewRepository } from './review.repository';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { SanctionedEntityService } from '../sanctioned-entity/sanctioned-entity.service';
import { ReviewDecisionEnum } from '../common/enums/review-decision.enum';
import { BlacklistStatusEnum } from '../common/enums/blacklist-status.enum';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditActionEnum } from '../common/enums/audit-action.enum';
import { NotificationService } from '../notification/notification.service';
import { WebhookEventTypeEnum } from '../webhook/enums/webhook-event-type.enum';
import { WebhookService } from '../webhook/webhook.service';

@Injectable()
export class ReviewService {
  constructor(
    private readonly reviewRepository: ReviewRepository,
    private readonly sanctionedEntityService: SanctionedEntityService,
    private readonly auditLogService: AuditLogService,
    private readonly notificationService: NotificationService,
    private readonly webhookService: WebhookService,
  ) {}

  async create(createReviewDto: CreateReviewDto) {
    const sanctionedEntity = await this.sanctionedEntityService.findOne(
      createReviewDto.sanctionedEntityId,
    );

    const review = this.reviewRepository.create(createReviewDto);
    const saved = await this.reviewRepository.save(review);

    await this.auditLogService.log({
      action: AuditActionEnum.REVIEW_CREATED,
      entityType: 'Review',
      entityId: saved.id,
      metadata: {
        sanctionedEntityId: createReviewDto.sanctionedEntityId,
        decision: createReviewDto.decision,
        reviewerId: createReviewDto.reviewerId,
      },
    });

    if (
      createReviewDto.decision === ReviewDecisionEnum.APPROVED &&
      sanctionedEntity.status !== BlacklistStatusEnum.VALID
    ) {
      await this.sanctionedEntityService.update(sanctionedEntity.id, {
        status: BlacklistStatusEnum.VALID,
      });

      try {
        await this.webhookService.distributeBatch(
          sanctionedEntity.id,
          WebhookEventTypeEnum.BATCH_VALIDATED,
          undefined,
          { allowNoTargets: true },
        );
      } catch (err) {
        const error = err as Error;
        console.error(
          `[ReviewService] Automatic webhook distribution failed for batch ${sanctionedEntity.id}: ${error.message}`,
        );
      }
    }

    if (
      createReviewDto.decision === ReviewDecisionEnum.REJECTED &&
      sanctionedEntity.status !== BlacklistStatusEnum.ERRONEOUS
    ) {
      await this.sanctionedEntityService.update(sanctionedEntity.id, {
        status: BlacklistStatusEnum.ERRONEOUS,
      });

      // Notify the creator
      const targetUserId = sanctionedEntity.createdById || createReviewDto.reviewerId;
      console.log(`[ReviewService] Triggering notification for user: ${targetUserId} (createdById: ${sanctionedEntity.createdById}, reviewerId: ${createReviewDto.reviewerId})`);
      
      if (targetUserId) {
        try {
          const notif = await this.notificationService.create({
            userId: targetUserId,
            title: 'Batch Rejected',
            message: `Batch "${sanctionedEntity.source}" was rejected: ${createReviewDto.comment || 'No reason provided.'}${!sanctionedEntity.createdById ? ' (Note: You received this because you are the reviewer and this batch had no owner)' : ''}`,
            link: `/app/blacklists`,
          });
          console.log(`[ReviewService] Notification created successfully in DB with ID: ${notif?.id}`);
        } catch (err) {
          console.error(`[ReviewService] Failed to create notification: ${err.message}`);
        }
      } else {
        console.warn(`[ReviewService] Skipping notification: No target user ID found (batch owner and reviewer both null)`);
      }
    }

    return saved;
  }

  findAll() {
    return this.reviewRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    const review = await this.reviewRepository.findOne({ where: { id } });
    if (!review) {
      throw new NotFoundException('Review not found');
    }
    return review;
  }

  async update(id: string, updateReviewDto: UpdateReviewDto) {
    const review = await this.reviewRepository.preload({
      id,
      ...updateReviewDto,
    });
    if (!review) {
      throw new NotFoundException('Review not found');
    }
    return this.reviewRepository.save(review);
  }

  async remove(id: string) {
    const review = await this.findOne(id);
    await this.reviewRepository.softDelete(id);
    return { deleted: true };
  }
}
