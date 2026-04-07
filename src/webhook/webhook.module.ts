import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SanctionedEntityModule } from '../sanctioned-entity/sanctioned-entity.module';
import { WebhookDelivery } from './entities/webhook-delivery.entity';
import { WebhookTarget } from './entities/webhook-target.entity';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([WebhookTarget, WebhookDelivery]),
    SanctionedEntityModule,
  ],
  controllers: [WebhookController],
  providers: [WebhookService],
  exports: [WebhookService],
})
export class WebhookModule {}
