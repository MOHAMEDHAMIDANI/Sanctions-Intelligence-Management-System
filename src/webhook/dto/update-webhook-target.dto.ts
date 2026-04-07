import { PartialType } from '@nestjs/mapped-types';
import { CreateWebhookTargetDto } from './create-webhook-target.dto';

export class UpdateWebhookTargetDto extends PartialType(CreateWebhookTargetDto) {}
