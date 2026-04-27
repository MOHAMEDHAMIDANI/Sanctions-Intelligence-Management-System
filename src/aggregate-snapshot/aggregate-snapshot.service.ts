import { Injectable, NotFoundException } from '@nestjs/common';
import { AggregateSnapshotRepository } from './aggregate-snapshot.repository';
import { CreateAggregateSnapshotDto } from './dto/create-aggregate-snapshot.dto';
import { UpdateAggregateSnapshotDto } from './dto/update-aggregate-snapshot.dto';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditActionEnum } from '../common/enums/audit-action.enum';

@Injectable()
export class AggregateSnapshotService {
  constructor(
    private readonly aggregateSnapshotRepository: AggregateSnapshotRepository,
    private readonly auditLogService: AuditLogService,
  ) {}

  async create(createAggregateSnapshotDto: CreateAggregateSnapshotDto) {
    const snapshot = this.aggregateSnapshotRepository.create(
      createAggregateSnapshotDto,
    );
    const saved = await this.aggregateSnapshotRepository.save(snapshot);
    await this.auditLogService.log({
      action: AuditActionEnum.ENTITY_CREATED,
      entityType: 'AggregateSnapshot',
      entityId: saved.id,
      metadata: { entityProfileId: saved.entityProfileId },
    });
    return saved;
  }

  findAll() {
    return this.aggregateSnapshotRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    const snapshot = await this.aggregateSnapshotRepository.findOne({
      where: { id },
    });
    if (!snapshot) {
      throw new NotFoundException('Aggregate snapshot not found');
    }
    return snapshot;
  }

  async update(
    id: string,
    updateAggregateSnapshotDto: UpdateAggregateSnapshotDto,
  ) {
    const snapshot = await this.aggregateSnapshotRepository.preload({
      id,
      ...updateAggregateSnapshotDto,
    });
    if (!snapshot) {
      throw new NotFoundException('Aggregate snapshot not found');
    }
    const saved = await this.aggregateSnapshotRepository.save(snapshot);
    await this.auditLogService.log({
      action: AuditActionEnum.ENTITY_UPDATED,
      entityType: 'AggregateSnapshot',
      entityId: saved.id,
      metadata: updateAggregateSnapshotDto as Record<string, unknown>,
    });
    return saved;
  }

  async remove(id: string) {
    const snapshot = await this.findOne(id);
    await this.aggregateSnapshotRepository.remove(snapshot);
    await this.auditLogService.log({
      action: AuditActionEnum.ENTITY_REMOVED,
      entityType: 'AggregateSnapshot',
      entityId: snapshot.id,
      metadata: { entityProfileId: snapshot.entityProfileId },
    });
    return { deleted: true };
  }
}
