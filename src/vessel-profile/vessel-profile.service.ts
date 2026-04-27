import { Injectable, NotFoundException } from '@nestjs/common';
import { VesselProfileRepository } from './vessel-profile.repository';
import { CreateVesselProfileDto } from './dto/create-vessel-profile.dto';
import { UpdateVesselProfileDto } from './dto/update-vessel-profile.dto';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditActionEnum } from '../common/enums/audit-action.enum';

@Injectable()
export class VesselProfileService {
  constructor(
    private readonly vesselProfileRepository: VesselProfileRepository,
    private readonly auditLogService: AuditLogService,
  ) {}

  async create(createVesselProfileDto: CreateVesselProfileDto) {
    const profile = this.vesselProfileRepository.create(createVesselProfileDto);
    const saved = await this.vesselProfileRepository.save(profile);
    await this.auditLogService.log({
      action: AuditActionEnum.ENTITY_CREATED,
      entityType: 'VesselProfile',
      entityId: saved.id,
      metadata: { entityProfileId: saved.entityProfileId },
    });
    return saved;
  }

  findAll() {
    return this.vesselProfileRepository.find();
  }

  async findOne(id: string) {
    const profile = await this.vesselProfileRepository.findOne({
      where: { id },
    });
    if (!profile) {
      throw new NotFoundException('Vessel profile not found');
    }
    return profile;
  }

  async update(id: string, updateVesselProfileDto: UpdateVesselProfileDto) {
    const profile = await this.vesselProfileRepository.preload({
      id,
      ...updateVesselProfileDto,
    });
    if (!profile) {
      throw new NotFoundException('Vessel profile not found');
    }
    const saved = await this.vesselProfileRepository.save(profile);
    await this.auditLogService.log({
      action: AuditActionEnum.ENTITY_UPDATED,
      entityType: 'VesselProfile',
      entityId: saved.id,
      metadata: updateVesselProfileDto as Record<string, unknown>,
    });
    return saved;
  }

  async remove(id: string) {
    const profile = await this.findOne(id);
    await this.vesselProfileRepository.remove(profile);
    await this.auditLogService.log({
      action: AuditActionEnum.ENTITY_REMOVED,
      entityType: 'VesselProfile',
      entityId: profile.id,
      metadata: { entityProfileId: profile.entityProfileId },
    });
    return { deleted: true };
  }
}
