import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateWebhookTargetDto } from './dto/create-webhook-target.dto';
import { TestDeliveryDto } from './dto/test-delivery.dto';
import { UpdateWebhookTargetDto } from './dto/update-webhook-target.dto';
import { WebhookService } from './webhook.service';

@Controller('webhooks')
@UseGuards(JwtAuthGuard)
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Get('targets')
  getTargets() {
    return this.webhookService.getTargets();
  }

  @Post('targets')
  createTarget(@Body() createDto: CreateWebhookTargetDto) {
    return this.webhookService.createTarget(createDto);
  }

  @Put('targets/:id')
  updateTarget(
    @Param('id') id: string,
    @Body() updateDto: UpdateWebhookTargetDto,
  ) {
    return this.webhookService.updateTarget(id, updateDto);
  }

  @Delete('targets/:id')
  deleteTarget(@Param('id') id: string) {
    return this.webhookService.deleteTarget(id);
  }

  @Get('deliveries')
  getDeliveries(@Query('targetId') targetId?: string) {
    return this.webhookService.getDeliveries(targetId);
  }

  @Post('test-delivery')
  testDelivery(@Body() body: TestDeliveryDto) {
    return this.webhookService.testDelivery(
      body.batchId,
      body.targetId,
      body.eventType,
    );
  }
}
