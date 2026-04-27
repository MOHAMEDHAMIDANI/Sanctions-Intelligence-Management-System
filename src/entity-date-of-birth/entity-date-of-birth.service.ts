import { Injectable, NotFoundException } from '@nestjs/common';
import { EntityDateOfBirthRepository } from './entity-date-of-birth.repository';
import { CreateEntityDateOfBirthDto } from './dto/create-entity-date-of-birth.dto';
import { UpdateEntityDateOfBirthDto } from './dto/update-entity-date-of-birth.dto';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditActionEnum } from '../common/enums/audit-action.enum';

@Injectable()
export class EntityDateOfBirthService {
  constructor(
    private readonly entityDateOfBirthRepository: EntityDateOfBirthRepository,
    private readonly auditLogService: AuditLogService,
  ) {}

  async create(createEntityDateOfBirthDto: CreateEntityDateOfBirthDto) {
    const dob = this.entityDateOfBirthRepository.create(
      createEntityDateOfBirthDto,
    );
    const saved = await this.entityDateOfBirthRepository.save(dob);
    await this.auditLogService.log({
      action: AuditActionEnum.ENTITY_CREATED,
      entityType: 'EntityDateOfBirth',
      entityId: saved.id,
      metadata: { entityProfileId: saved.entityProfileId },
    });
    return saved;
  }

  findAll() {
    return this.entityDateOfBirthRepository.find();
  }

  async findOne(id: string) {
    const dob = await this.entityDateOfBirthRepository.findOne({
      where: { id },
    });
    if (!dob) {
      throw new NotFoundException('Entity date of birth not found');
    }
    return dob;
  }

  async update(
    id: string,
    updateEntityDateOfBirthDto: UpdateEntityDateOfBirthDto,
  ) {
    const dob = await this.entityDateOfBirthRepository.preload({
      id,
      ...updateEntityDateOfBirthDto,
    });
    if (!dob) {
      throw new NotFoundException('Entity date of birth not found');
    }
    const saved = await this.entityDateOfBirthRepository.save(dob);
    await this.auditLogService.log({
      action: AuditActionEnum.ENTITY_UPDATED,
      entityType: 'EntityDateOfBirth',
      entityId: saved.id,
      metadata: updateEntityDateOfBirthDto as Record<string, unknown>,
    });
    return saved;
  }

  async remove(id: string) {
    const dob = await this.findOne(id);
    await this.entityDateOfBirthRepository.remove(dob);
    await this.auditLogService.log({
      action: AuditActionEnum.ENTITY_REMOVED,
      entityType: 'EntityDateOfBirth',
      entityId: dob.id,
      metadata: { entityProfileId: dob.entityProfileId },
    });
    return { deleted: true };
  }
}
