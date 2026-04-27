import { Injectable, NotFoundException } from '@nestjs/common';
import { EntityBankAccountRepository } from './entity-bank-account.repository';
import { CreateEntityBankAccountDto } from './dto/create-entity-bank-account.dto';
import { UpdateEntityBankAccountDto } from './dto/update-entity-bank-account.dto';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditActionEnum } from '../common/enums/audit-action.enum';

@Injectable()
export class EntityBankAccountService {
  constructor(
    private readonly entityBankAccountRepository: EntityBankAccountRepository,
    private readonly auditLogService: AuditLogService,
  ) {}

  async create(createEntityBankAccountDto: CreateEntityBankAccountDto) {
    const account = this.entityBankAccountRepository.create(
      createEntityBankAccountDto,
    );
    const saved = await this.entityBankAccountRepository.save(account);
    await this.auditLogService.log({
      action: AuditActionEnum.ENTITY_CREATED,
      entityType: 'EntityBankAccount',
      entityId: saved.id,
      metadata: { entityProfileId: saved.entityProfileId },
    });
    return saved;
  }

  findAll() {
    return this.entityBankAccountRepository.find();
  }

  async findOne(id: string) {
    const account = await this.entityBankAccountRepository.findOne({
      where: { id },
    });
    if (!account) {
      throw new NotFoundException('Entity bank account not found');
    }
    return account;
  }

  async update(
    id: string,
    updateEntityBankAccountDto: UpdateEntityBankAccountDto,
  ) {
    const account = await this.entityBankAccountRepository.preload({
      id,
      ...updateEntityBankAccountDto,
    });
    if (!account) {
      throw new NotFoundException('Entity bank account not found');
    }
    const saved = await this.entityBankAccountRepository.save(account);
    await this.auditLogService.log({
      action: AuditActionEnum.ENTITY_UPDATED,
      entityType: 'EntityBankAccount',
      entityId: saved.id,
      metadata: updateEntityBankAccountDto as Record<string, unknown>,
    });
    return saved;
  }

  async remove(id: string) {
    const account = await this.findOne(id);
    await this.entityBankAccountRepository.remove(account);
    await this.auditLogService.log({
      action: AuditActionEnum.ENTITY_REMOVED,
      entityType: 'EntityBankAccount',
      entityId: account.id,
      metadata: { entityProfileId: account.entityProfileId },
    });
    return { deleted: true };
  }
}
