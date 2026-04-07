import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';
import { WebhookEventTypeEnum } from '../enums/webhook-event-type.enum';
import { WebhookFormatEnum } from '../enums/webhook-format.enum';

export class CreateWebhookTargetDto {
  @IsString()
  name: string;

  @IsUrl({ require_tld: false })
  url: string;

  @IsOptional()
  @IsEnum(WebhookFormatEnum)
  format?: WebhookFormatEnum;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  secretKey?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsObject()
  mapping?: Record<string, string>;

  @IsOptional()
  @IsArray()
  @IsEnum(WebhookEventTypeEnum, { each: true })
  eventTypes?: WebhookEventTypeEnum[];
}
