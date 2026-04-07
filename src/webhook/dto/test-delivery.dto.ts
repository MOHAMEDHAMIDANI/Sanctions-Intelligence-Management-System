import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { WebhookEventTypeEnum } from '../enums/webhook-event-type.enum';

export class TestDeliveryDto {
  @IsUUID()
  batchId: string;

  @IsUUID()
  targetId: string;

  @IsOptional()
  @IsEnum(WebhookEventTypeEnum)
  eventType?: WebhookEventTypeEnum;
}
