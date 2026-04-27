import { Injectable, NotFoundException } from '@nestjs/common';
import { IndividualProfileRepository } from './individual-profile.repository';
import { CreateIndividualProfileDto } from './dto/create-individual-profile.dto';
import { UpdateIndividualProfileDto } from './dto/update-individual-profile.dto';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditActionEnum } from '../common/enums/audit-action.enum';

@Injectable()
export class IndividualProfileService {
  constructor(
    private readonly individualProfileRepository: IndividualProfileRepository,
    private readonly auditLogService: AuditLogService,
  ) {}

  async create(createIndividualProfileDto: CreateIndividualProfileDto) {
    const profile = this.individualProfileRepository.create(
      createIndividualProfileDto,
    );
    const saved = await this.individualProfileRepository.save(profile);
    await this.auditLogService.log({
      action: AuditActionEnum.ENTITY_CREATED,
      entityType: 'IndividualProfile',
      entityId: saved.id,
      metadata: { entityProfileId: saved.entityProfileId },
    });
    return saved;
  }

  findAll() {
    return this.individualProfileRepository.find();
  }

  async findOne(id: string) {
    const profile = await this.individualProfileRepository.findOne({
      where: { id },
    });
    if (!profile) {
      throw new NotFoundException('Individual profile not found');
    }
    return profile;
  }

  async update(
    id: string,
    updateIndividualProfileDto: UpdateIndividualProfileDto,
  ) {
    const profile = await this.individualProfileRepository.preload({
      id,
      ...updateIndividualProfileDto,
    });
    if (!profile) {
      throw new NotFoundException('Individual profile not found');
    }
    const saved = await this.individualProfileRepository.save(profile);
    await this.auditLogService.log({
      action: AuditActionEnum.ENTITY_UPDATED,
      entityType: 'IndividualProfile',
      entityId: saved.id,
      metadata: updateIndividualProfileDto as Record<string, unknown>,
    });
    return saved;
  }

  async remove(id: string) {
    const profile = await this.findOne(id);
    await this.individualProfileRepository.remove(profile);
    await this.auditLogService.log({
      action: AuditActionEnum.ENTITY_REMOVED,
      entityType: 'IndividualProfile',
      entityId: profile.id,
      metadata: { entityProfileId: profile.entityProfileId },
    });
    return { deleted: true };
  }
}
