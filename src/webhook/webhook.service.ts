import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import { createHmac, randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditActionEnum } from '../common/enums/audit-action.enum';
import { SanctionedEntityService } from '../sanctioned-entity/sanctioned-entity.service';
import { CreateWebhookTargetDto } from './dto/create-webhook-target.dto';
import { UpdateWebhookTargetDto } from './dto/update-webhook-target.dto';
import { WebhookDeliveryStatusEnum } from './enums/webhook-delivery-status.enum';
import { WebhookEventTypeEnum } from './enums/webhook-event-type.enum';
import { WebhookFormatEnum } from './enums/webhook-format.enum';
import { WebhookDelivery } from './entities/webhook-delivery.entity';
import { WebhookTarget } from './entities/webhook-target.entity';

type PreparedRequest = {
  body: any;
  contentType: string;
};

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    @InjectRepository(WebhookTarget)
    private readonly webhookTargetRepository: Repository<WebhookTarget>,
    @InjectRepository(WebhookDelivery)
    private readonly webhookDeliveryRepository: Repository<WebhookDelivery>,
    private readonly auditLogService: AuditLogService,
    private readonly sanctionedEntityService: SanctionedEntityService,
  ) {}

  async getTargets() {
    const targets = await this.webhookTargetRepository.find({
      order: { createdAt: 'DESC' },
    });
    return targets.map((target) => this.sanitizeTarget(target));
  }

  async createTarget(createDto: CreateWebhookTargetDto) {
    const plainSecretKey =
      createDto.secretKey?.trim() || `sk_${randomBytes(18).toString('hex')}`;
    const target = this.webhookTargetRepository.create({
      ...createDto,
      secretKey: plainSecretKey,
      format: createDto.format || WebhookFormatEnum.JSON,
      isActive: createDto.isActive ?? true,
      mapping: createDto.mapping || {},
      eventTypes: createDto.eventTypes || [WebhookEventTypeEnum.BATCH_VALIDATED],
    });
    const savedTarget = await this.webhookTargetRepository.save(target);

    return {
      ...this.sanitizeTarget(savedTarget),
      plainSecretKey,
    };
  }

  async updateTarget(id: string, updateDto: UpdateWebhookTargetDto) {
    const target = await this.webhookTargetRepository.findOne({ where: { id } });
    if (!target) {
      throw new NotFoundException('Webhook target not found');
    }

    Object.assign(target, updateDto);

    if (updateDto.secretKey !== undefined) {
      target.secretKey = updateDto.secretKey?.trim() || target.secretKey;
    }

    if (updateDto.mapping !== undefined) {
      target.mapping = updateDto.mapping || {};
    }

    if (updateDto.eventTypes !== undefined) {
      target.eventTypes = updateDto.eventTypes;
    }

    const savedTarget = await this.webhookTargetRepository.save(target);
    return this.sanitizeTarget(savedTarget);
  }

  async deleteTarget(id: string) {
    const target = await this.webhookTargetRepository.findOne({ where: { id } });
    if (!target) {
      throw new NotFoundException('Webhook target not found');
    }
    await this.webhookTargetRepository.remove(target);
    return { deleted: true };
  }

  async getDeliveries(targetId?: string, batchId?: string) {
    const where: Record<string, string> = {};
    if (targetId) {
      where.targetId = targetId;
    }
    if (batchId) {
      where.batchId = batchId;
    }

    const deliveries = await this.webhookDeliveryRepository.find({
      where,
      relations: ['target'],
      order: { attemptedAt: 'DESC' },
    });

    return deliveries.map((delivery) => ({
      ...delivery,
      target:
        (delivery.target
          ? this.sanitizeTarget(delivery.target)
          : null) ||
        (delivery.targetName
          ? {
              id: delivery.targetId,
              name: delivery.targetName,
              format: delivery.targetFormat,
            }
          : null),
    }));
  }

  async testDelivery(
    batchId: string,
    targetId: string,
    eventType: WebhookEventTypeEnum = WebhookEventTypeEnum.BATCH_VALIDATED,
  ) {
    const [delivery] = await this.distributeBatch(batchId, eventType, targetId, {
      allowNoTargets: false,
    });
    return delivery;
  }

  async distributeBatch(
    batchId: string,
    eventType: WebhookEventTypeEnum,
    targetId?: string,
    options: { allowNoTargets?: boolean } = {},
  ) {
    const batch = await this.sanctionedEntityService.findOne(batchId);
    const entries = await this.sanctionedEntityService.getEntries(batchId);

    await this.auditLogService.log({
      action: AuditActionEnum.DISTRIBUTION_STARTED,
      entityType: 'SanctionedEntity',
      entityId: batchId,
      metadata: {
        eventType,
        targetId: targetId || null,
      },
    });

    const targets = targetId
      ? await this.webhookTargetRepository.find({ where: { id: targetId } })
      : await this.webhookTargetRepository.find({ where: { isActive: true } });

    const filteredTargets = targets.filter((target) => {
      if (targetId) {
        return true;
      }
      return (target.eventTypes || []).includes(eventType);
    });

    if (!filteredTargets.length) {
      if (options.allowNoTargets) {
        this.logger.warn(
          `No webhook targets matched event ${eventType} for batch ${batchId}`,
        );
        return [];
      }
      throw new BadRequestException('No matching webhook targets found');
    }

    const deliveries: WebhookDelivery[] = [];
    for (const target of filteredTargets) {
      deliveries.push(
        await this.sendDelivery({
          batch,
          entries,
          eventType,
          target,
        }),
      );
    }

    const hasFailures = deliveries.some(
      (delivery) => delivery.status === WebhookDeliveryStatusEnum.FAILED,
    );

    await this.auditLogService.log({
      action: hasFailures
        ? AuditActionEnum.DISTRIBUTION_FAILED
        : AuditActionEnum.DISTRIBUTION_COMPLETED,
      entityType: 'SanctionedEntity',
      entityId: batchId,
      metadata: {
        eventType,
        targetId: targetId || null,
        deliveryCount: deliveries.length,
        failedCount: deliveries.filter(
          (delivery) => delivery.status === WebhookDeliveryStatusEnum.FAILED,
        ).length,
      },
    });

    return deliveries;
  }

  async retryFailedDeliveries(batchId: string, targetId?: string) {
    const failedDeliveries = await this.webhookDeliveryRepository.find({
      where: {
        batchId,
        status: WebhookDeliveryStatusEnum.FAILED,
        ...(targetId ? { targetId } : {}),
      },
      relations: ['target'],
      order: { attemptedAt: 'DESC' },
    });

    if (!failedDeliveries.length) {
      throw new NotFoundException('No failed deliveries found for retry');
    }

    const uniqueTargets = new Map<string, WebhookDelivery>();
    for (const delivery of failedDeliveries) {
      const deliveryKey = delivery.targetId || `${delivery.targetName}:${delivery.eventType}`;
      if (!uniqueTargets.has(deliveryKey)) {
        uniqueTargets.set(deliveryKey, delivery);
      }
    }

    const batch = await this.sanctionedEntityService.findOne(batchId);
    const entries = await this.sanctionedEntityService.getEntries(batchId);
    const retriedDeliveries: WebhookDelivery[] = [];

    for (const failedDelivery of uniqueTargets.values()) {
      const target = failedDelivery.targetId
        ? await this.webhookTargetRepository.findOne({
            where: { id: failedDelivery.targetId },
          })
        : null;

      if (!target) {
        this.logger.warn(
          `Skipping retry for batch ${batchId} because target ${failedDelivery.targetId} no longer exists`,
        );
        continue;
      }

      retriedDeliveries.push(
        await this.sendDelivery({
          batch,
          entries,
          eventType: failedDelivery.eventType as WebhookEventTypeEnum,
          target,
        }),
      );
    }

    return retriedDeliveries;
  }

  private async sendDelivery(params: {
    batch: any;
    entries: Record<string, any>[];
    eventType: WebhookEventTypeEnum;
    target: WebhookTarget;
  }) {
    const { batch, entries, eventType, target } = params;
    const requestPayload = this.buildPayload(batch, entries, eventType, target);
    const request = this.prepareRequestBody(requestPayload, target);
    const previousAttemptCount = await this.webhookDeliveryRepository.count({
      where: {
        batchId: batch.id,
        targetId: target.id,
      },
    });

    const delivery = this.webhookDeliveryRepository.create({
      batchId: batch.id,
      targetId: target.id,
      targetName: target.name,
      targetFormat: target.format,
      eventType,
      payload: requestPayload.inspectorPayload,
      status: WebhookDeliveryStatusEnum.PENDING,
      attemptCount: previousAttemptCount + 1,
    });
    const savedDelivery = await this.webhookDeliveryRepository.save(delivery);

    const startedAt = Date.now();

    try {
      const serializedBody = this.serializeForSignature(request.body);
      const headers = this.buildHeaders(
        target,
        eventType,
        request.contentType,
        serializedBody,
      );
      const response = await axios.post(target.url, request.body, {
        headers,
        timeout: 10000,
        validateStatus: () => true,
        responseType: 'text',
        transformResponse: [(data) => data],
      });

      const responseBody = this.parseResponseBody(response.data);
      savedDelivery.status =
        response.status >= 200 && response.status < 300
          ? WebhookDeliveryStatusEnum.SUCCESS
          : WebhookDeliveryStatusEnum.FAILED;
      savedDelivery.responseStatus = response.status;
      savedDelivery.responseBody = responseBody;
      savedDelivery.durationMs = Date.now() - startedAt;
      savedDelivery.errorMessage =
        savedDelivery.status === WebhookDeliveryStatusEnum.FAILED
          ? `Destination returned HTTP ${response.status}`
          : null;

      return this.webhookDeliveryRepository.save(savedDelivery);
    } catch (error) {
      const err = error as Error & {
        response?: { status?: number; data?: unknown };
      };

      savedDelivery.status = WebhookDeliveryStatusEnum.FAILED;
      savedDelivery.responseStatus = err.response?.status || null;
      savedDelivery.responseBody = this.parseResponseBody(err.response?.data);
      savedDelivery.durationMs = Date.now() - startedAt;
      savedDelivery.errorMessage = err.message;

      this.logger.error(
        `Webhook delivery failed for target ${target.name}: ${err.message}`,
      );

      return this.webhookDeliveryRepository.save(savedDelivery);
    }
  }

  private buildPayload(
    batch: any,
    entries: Record<string, any>[],
    eventType: WebhookEventTypeEnum,
    target: WebhookTarget,
  ) {
    const baseBatch = {
      id: batch.id,
      blacklistId: batch.blacklistId,
      source: batch.source,
      status: batch.status,
      date: batch.date,
      entriesCount: batch.entriesCount,
      createdAt: batch.createdAt,
      updatedAt: batch.updatedAt,
    };

    const basePayload = {
      eventType,
      sentAt: new Date().toISOString(),
      batch: baseBatch,
      entries,
    };

    switch (target.format) {
      case WebhookFormatEnum.CUSTOM: {
        const mappedEntries = entries.map((entry) =>
          this.applyMapping(entry, target.mapping || {}),
        );
        return {
          inspectorPayload: {
            ...basePayload,
            entries: mappedEntries,
          },
          outboundPayload: {
            ...basePayload,
            entries: mappedEntries,
          },
        };
      }
      case WebhookFormatEnum.HMT:
        return {
          inspectorPayload: {
            ...basePayload,
            entries: entries.map((entry) => this.toHmtEntry(entry)),
          },
          outboundPayload: this.buildHmtWorkbook(baseBatch, entries),
        };
      case WebhookFormatEnum.XML:
        return {
          inspectorPayload: basePayload,
          outboundPayload: this.buildXmlPayload(baseBatch, entries, eventType),
        };
      case WebhookFormatEnum.EXCEL:
        return {
          inspectorPayload: basePayload,
          outboundPayload: this.buildExcelWorkbook(baseBatch, entries),
        };
      case WebhookFormatEnum.JSON:
      default:
        return {
          inspectorPayload: basePayload,
          outboundPayload: basePayload,
        };
    }
  }

  private prepareRequestBody(
    payload: { inspectorPayload: any; outboundPayload: any },
    target: WebhookTarget,
  ): PreparedRequest {
    switch (target.format) {
      case WebhookFormatEnum.XML:
        return {
          body: payload.outboundPayload,
          contentType: 'application/xml',
        };
      case WebhookFormatEnum.HMT:
        return {
          body: payload.outboundPayload,
          contentType:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        };
      case WebhookFormatEnum.EXCEL:
        return {
          body: payload.outboundPayload,
          contentType:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        };
      case WebhookFormatEnum.CUSTOM:
      case WebhookFormatEnum.JSON:
      default:
        return {
          body: payload.outboundPayload,
          contentType: 'application/json',
        };
    }
  }

  private buildHeaders(
    target: WebhookTarget,
    eventType: WebhookEventTypeEnum,
    contentType: string,
    serializedBody: Buffer | string,
  ) {
    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'X-Blacklist-Event': eventType,
      'X-Blacklist-Target': target.name,
      'User-Agent': 'Blacklist-Distribution-Node/2.0',
    };

    if (target.secretKey) {
      const signature = createHmac('sha256', target.secretKey)
        .update(serializedBody)
        .digest('hex');
      headers['X-Blacklist-Signature'] = `sha256=${signature}`;
    }

    return headers;
  }

  private serializeForSignature(body: unknown) {
    if (Buffer.isBuffer(body)) {
      return body;
    }
    if (typeof body === 'string') {
      return body;
    }
    return JSON.stringify(body);
  }

  private parseResponseBody(data: unknown) {
    if (data === undefined || data === null || data === '') {
      return null;
    }
    if (typeof data !== 'string') {
      return data;
    }
    try {
      return JSON.parse(data);
    } catch {
      return data;
    }
  }

  private applyMapping(
    entry: Record<string, any>,
    mapping: Record<string, string>,
  ) {
    const mappingKeys = Object.keys(mapping);
    if (!mappingKeys.length) {
      return entry;
    }

    return mappingKeys.reduce<Record<string, any>>((acc, targetKey) => {
      const sourceKey = mapping[targetKey];
      acc[targetKey] = entry[sourceKey];
      return acc;
    }, {});
  }

  private toHmtEntry(entry: Record<string, any>) {
    return {
      GroupID: entry.groupId || '',
      Name1: entry.name1 || entry.fullName || '',
      Name2: entry.name2 || '',
      Name3: entry.name3 || '',
      Name4: entry.name4 || '',
      Name5: entry.name5 || '',
      Name6: entry.name6 || '',
      Title: entry.title || '',
      DOB: entry.dob || '',
      TownOfBirth: entry.townOfBirth || '',
      CountryOfBirth: entry.countryOfBirth || '',
      Nationality: entry.nationality || '',
      PassportNumber: entry.passportNum || '',
      NationalID: entry.nationalId || '',
      Address1: entry.addr1 || '',
      Address2: entry.addr2 || '',
      Address3: entry.addr3 || '',
      Address4: entry.addr4 || '',
      Address5: entry.addr5 || '',
      Address6: entry.addr6 || '',
      Country: entry.country || '',
      ListedOn: entry.listedOn || '',
      OtherInformation: entry.otherInfo || '',
    };
  }

  private buildXmlPayload(
    batch: Record<string, any>,
    entries: Record<string, any>[],
    eventType: WebhookEventTypeEnum,
  ) {
    const entryXml = entries
      .map((entry) => {
        const fields = Object.entries(entry)
          .filter(([, value]) => value !== undefined && value !== null && value !== '')
          .map(
            ([key, value]) =>
              `<${key}>${this.escapeXml(String(value))}</${key}>`,
          )
          .join('');

        return `<entry>${fields}</entry>`;
      })
      .join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<distribution>
  <eventType>${eventType}</eventType>
  <sentAt>${new Date().toISOString()}</sentAt>
  <batch>
    <id>${this.escapeXml(String(batch.id))}</id>
    <blacklistId>${this.escapeXml(String(batch.blacklistId || ''))}</blacklistId>
    <source>${this.escapeXml(String(batch.source || ''))}</source>
    <status>${this.escapeXml(String(batch.status || ''))}</status>
    <entriesCount>${this.escapeXml(String(batch.entriesCount || 0))}</entriesCount>
  </batch>
  <entries>${entryXml}</entries>
</distribution>`;
  }

  private buildHmtWorkbook(batch: Record<string, any>, entries: Record<string, any>[]) {
    const xlsx = this.loadXlsx();
    const workbook = xlsx.utils.book_new();
    const hmtEntries = entries.map((entry) => this.toHmtEntry(entry));
    const metaSheet = xlsx.utils.json_to_sheet([
      {
        blacklistId: batch.blacklistId || '',
        source: batch.source || '',
        status: batch.status || '',
        entriesCount: batch.entriesCount || 0,
        exportedAt: new Date().toISOString(),
      },
    ]);
    const entrySheet = xlsx.utils.json_to_sheet(hmtEntries);

    xlsx.utils.book_append_sheet(workbook, metaSheet, 'Batch');
    xlsx.utils.book_append_sheet(workbook, entrySheet, 'HMT');

    return xlsx.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
    });
  }

  private buildExcelWorkbook(batch: Record<string, any>, entries: Record<string, any>[]) {
    const xlsx = this.loadXlsx();
    const workbook = xlsx.utils.book_new();
    const batchSheet = xlsx.utils.json_to_sheet([batch]);
    const entrySheet = xlsx.utils.json_to_sheet(entries);

    xlsx.utils.book_append_sheet(workbook, batchSheet, 'Batch');
    xlsx.utils.book_append_sheet(workbook, entrySheet, 'Entries');

    return xlsx.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
    });
  }

  private loadXlsx() {
    try {
      return require('xlsx');
    } catch {
      throw new BadRequestException(
        'Excel webhook delivery is unavailable because the xlsx package is not installed.',
      );
    }
  }

  private escapeXml(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private sanitizeTarget(target: WebhookTarget) {
    return {
      ...target,
      secretKey: this.maskSecretKey(target.secretKey),
    };
  }

  private maskSecretKey(secretKey?: string | null) {
    if (!secretKey) {
      return null;
    }

    return `sk_****${secretKey.slice(-4)}`;
  }
}
