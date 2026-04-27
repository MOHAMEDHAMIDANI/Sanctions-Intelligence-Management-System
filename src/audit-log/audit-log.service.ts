import { Injectable } from '@nestjs/common';
import { AuditLogRepository } from './audit-log.repository';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';

@Injectable()
export class AuditLogService {
  constructor(private readonly auditLogRepository: AuditLogRepository) {}

  create(createAuditLogDto: CreateAuditLogDto) {
    // Audit logs are append-only for compliance and must never be mutated.
    const log = this.auditLogRepository.create(createAuditLogDto);
    return this.auditLogRepository.save(log);
  }

  findAll(filters?: {
    entityId?: string;
    entityType?: string;
    batchId?: string;
  }) {
    const query = this.auditLogRepository
      .createQueryBuilder('audit')
      .leftJoinAndSelect('audit.user', 'user')
      .orderBy('audit.createdAt', 'DESC');

    if (filters?.entityId) {
      query.andWhere('audit.entityId = :entityId', {
        entityId: filters.entityId,
      });
    }

    if (filters?.entityType) {
      query.andWhere('audit.entityType = :entityType', {
        entityType: filters.entityType,
      });
    }

    if (filters?.batchId) {
      query.andWhere(
        '(audit.entityId = :batchId OR audit.metadata ->> :metadataKey = :batchId)',
        {
          batchId: filters.batchId,
          metadataKey: 'sanctionedEntityId',
        },
      );
    }

    return query.getMany();
  }

  findOne(id: string) {
    return this.auditLogRepository.findOne({ where: { id } });
  }

  log(entry: CreateAuditLogDto) {
    return this.create(entry);
  }
}
