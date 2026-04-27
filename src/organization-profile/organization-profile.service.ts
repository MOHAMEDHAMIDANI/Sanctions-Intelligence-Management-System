import { Injectable, NotFoundException } from '@nestjs/common';
import { OrganizationProfileRepository } from './organization-profile.repository';
import { CreateOrganizationProfileDto } from './dto/create-organization-profile.dto';
import { UpdateOrganizationProfileDto } from './dto/update-organization-profile.dto';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditActionEnum } from '../common/enums/audit-action.enum';

@Injectable()
export class OrganizationProfileService {
  constructor(
    private readonly organizationProfileRepository: OrganizationProfileRepository,
    private readonly auditLogService: AuditLogService,
  ) {}

  async create(createOrganizationProfileDto: CreateOrganizationProfileDto) {
    const profile = this.organizationProfileRepository.create(
      createOrganizationProfileDto,
    );
    const saved = await this.organizationProfileRepository.save(profile);
    await this.auditLogService.log({
      action: AuditActionEnum.ENTITY_CREATED,
      entityType: 'OrganizationProfile',
      entityId: saved.id,
      metadata: { entityProfileId: saved.entityProfileId },
    });
    return saved;
  }

  findAll() {
    return this.organizationProfileRepository.find();
  }

  async findOne(id: string) {
    const profile = await this.organizationProfileRepository.findOne({
      where: { id },
    });
    if (!profile) {
      throw new NotFoundException('Organization profile not found');
    }
    return profile;
  }

  async update(
    id: string,
    updateOrganizationProfileDto: UpdateOrganizationProfileDto,
  ) {
    const profile = await this.organizationProfileRepository.preload({
      id,
      ...updateOrganizationProfileDto,
    });
    if (!profile) {
      throw new NotFoundException('Organization profile not found');
    }
    const saved = await this.organizationProfileRepository.save(profile);
    await this.auditLogService.log({
      action: AuditActionEnum.ENTITY_UPDATED,
      entityType: 'OrganizationProfile',
      entityId: saved.id,
      metadata: updateOrganizationProfileDto as Record<string, unknown>,
    });
    return saved;
  }

  async remove(id: string) {
    const profile = await this.findOne(id);
    await this.organizationProfileRepository.remove(profile);
    await this.auditLogService.log({
      action: AuditActionEnum.ENTITY_REMOVED,
      entityType: 'OrganizationProfile',
      entityId: profile.id,
      metadata: { entityProfileId: profile.entityProfileId },
    });
    return { deleted: true };
  }
}
