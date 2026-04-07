import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { SanctionedEntityRepository } from './sanctioned-entity.repository';
import { CreateSanctionedEntityDto } from './dto/create-sanctioned-entity.dto';
import { UpdateSanctionedEntityDto } from './dto/update-sanctioned-entity.dto';
import { BlacklistStatusEnum } from '../common/enums/blacklist-status.enum';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditActionEnum } from '../common/enums/audit-action.enum';
import { EntityTypeEnum } from '../common/enums/entity-type.enum';
import { SanctionedEntity } from './entities/sanctioned-entity.entity';
import { EntityProfile } from '../entity-profile/entities/entity-profile.entity';
import { EntityName } from '../entity-name/entities/entity-name.entity';
import { EntityDateOfBirth } from '../entity-date-of-birth/entities/entity-date-of-birth.entity';
import { EntityAddress } from '../entity-address/entities/entity-address.entity';
import { IndividualProfile } from '../individual-profile/entities/individual-profile.entity';
import { NameTypeEnum } from '../common/enums/name-type.enum';
import { AddressTypeEnum } from '../common/enums/address-type.enum';
import { DataSource, EntityManager, Not, IsNull } from 'typeorm';

type UploadFormat = 'excel' | 'xml' | 'hmt' | 'pdf';

type UploadedFile = {
  originalname: string;
  buffer: Buffer;
  mimetype: string;
  size: number;
};

@Injectable()
export class SanctionedEntityService {
  private readonly logger = new Logger(SanctionedEntityService.name);

  constructor(
    private readonly sanctionedEntityRepository: SanctionedEntityRepository,
    private readonly auditLogService: AuditLogService,
    private readonly dataSource: DataSource,
  ) {}

  // ─────────────────────────────────────────────────────
  //  CRUD — SanctionedEntity is the BATCH / blacklist
  // ─────────────────────────────────────────────────────

  async create(dto: CreateSanctionedEntityDto) {
    const entity = this.sanctionedEntityRepository.create({
      source: dto.source,
      blacklistId: dto.blacklistId || null,
      status: dto.status ?? BlacklistStatusEnum.READY,
      date: dto.date || new Date().toISOString().split('T')[0],
      entriesCount: 0,
      createdById: dto.createdById || null,
    });
    const saved = await this.sanctionedEntityRepository.save(entity);

    await this.auditLogService.log({
      action: AuditActionEnum.SANCTIONED_ENTITY_CREATED,
      entityType: 'SanctionedEntity',
      entityId: saved.id,
      metadata: { status: saved.status },
    });
    return saved;
  }

  /** Returns all batches (blacklists) with their entry counts */
  findAll() {
    return this.sanctionedEntityRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    const entity = await this.sanctionedEntityRepository.findOne({
      where: { id },
    });
    if (!entity) {
      throw new NotFoundException('Sanctioned entity not found');
    }
    return entity;
  }

  async update(id: string, dto: Record<string, any>) {
    const entity = await this.findOne(id);
    const previousStatus = entity.status;
    const nextStatus = dto.status;
    if (nextStatus && nextStatus !== entity.status) {
      this.assertValidStatusTransition(entity.status, nextStatus);
    }

    // Update batch metadata
    if (dto.source) entity.source = dto.source;
    if (dto.blacklistId !== undefined) entity.blacklistId = dto.blacklistId;
    if (dto.status) entity.status = dto.status;

    // Handle manualData sync if provided by the frontend
    if (dto.manualData && Array.isArray(dto.manualData)) {
      const existingEntries = await this.dataSource.getRepository(EntityProfile).find({
        where: { sanctionedEntityId: id },
        select: ['id'],
      });

      const manualIdSet = new Set(dto.manualData.map((e: any) => String(e.id)));
      const existingIds = existingEntries.map((e) => e.id);

      // 1. Delete removed
      const toDelete = existingIds.filter(id => !manualIdSet.has(id));
      console.log(`[Update Batch] Calculated toDelete: ${toDelete.length} entries out of ${existingIds.length} existing.`);
      for (const delId of toDelete) {
        await this.deleteEntry(delId);
      }

      // 2. Add or Update
      let addCount = 0;
      let updateCount = 0;
      let skippedCount = 0;

      for (const manualEntry of dto.manualData) {
        const isNew = String(manualEntry.id).length < 20; // frontend uses Date.now() for new
        if (isNew) {
          addCount++;
          await this.addEntry(id, manualEntry);
        } else if (manualEntry._isDirty === true) {
          updateCount++;
          await this.updateEntry(manualEntry.id, manualEntry);
        } else {
          skippedCount++;
        }
      }
      
      console.log(`[Update Batch] Finished. Added: ${addCount}, Updated: ${updateCount}, Skipped: ${skippedCount}`);
      entity.entriesCount = dto.manualData.length;
    }

    const saved = await this.sanctionedEntityRepository.save(entity);
    if (nextStatus && nextStatus !== previousStatus) {
      await this.auditLogService.log({
        action: AuditActionEnum.SANCTIONED_ENTITY_STATUS_CHANGED,
        entityType: 'SanctionedEntity',
        entityId: saved.id,
        before: { status: previousStatus },
        after: { status: saved.status },
      });
    }
    return saved;
  }

  async remove(id: string) {
    const entity = await this.findOne(id);
    await this.sanctionedEntityRepository.softDelete(id);

    await this.auditLogService.log({
      action: AuditActionEnum.SANCTIONED_ENTITY_REMOVED,
      entityType: 'SanctionedEntity',
      entityId: id,
      metadata: { source: entity.source, softDelete: true },
    });

    return { archived: true };
  }

  /** Returns only soft-deleted (archived) blacklists */
  async findAllArchived() {
    return this.sanctionedEntityRepository.find({
      where: { deletedAt: Not(IsNull()) },
      withDeleted: true,
      order: { deletedAt: 'DESC' },
    });
  }

  /** Restores a soft-deleted blacklist */
  async restore(id: string) {
    await this.sanctionedEntityRepository.restore(id);
    const restored = await this.findOne(id);

    await this.auditLogService.log({
      action: AuditActionEnum.ENTITY_UPDATED,
      entityType: 'SanctionedEntity',
      entityId: id,
      metadata: { action: 'restore', source: restored.source },
    });

    return restored;
  }

  /** Permanently deletes a blacklist and all its entries */
  async permanentDelete(id: string) {
    const entity = await this.sanctionedEntityRepository.findOne({
      where: { id },
      withDeleted: true,
    });
    if (!entity) throw new NotFoundException('Sanctioned entity not found');

    // Hard delete
    await this.sanctionedEntityRepository.delete(id);

    await this.auditLogService.log({
      action: AuditActionEnum.SANCTIONED_ENTITY_REMOVED,
      entityType: 'SanctionedEntity',
      entityId: id,
      metadata: { source: entity.source, permanent: true },
    });

    return { deleted: true };
  }

  // ─────────────────────────────────────────────────────
  //  ENTRIES — EntityProfile rows inside a batch
  // ─────────────────────────────────────────────────────

  /** Get all entries (EntityProfiles) for a given batch */
  async getEntries(sanctionedEntityId: string) {
    await this.findOne(sanctionedEntityId); // ensure exists
    const profileRepo = this.dataSource.getRepository(EntityProfile);
    const profiles = await profileRepo.find({
      where: { sanctionedEntityId },
      relations: [
        'names',
        'addresses',
        'datesOfBirth',
        'individualProfile',
        'evidenceDocuments',
      ],
      order: { createdAt: 'ASC' },
    });

    // Flatten each profile into the column format the frontend expects
    return profiles.map((p) => this.flattenProfile(p));
  }

  /** Add a single entry to an existing batch */
  async addEntry(sanctionedEntityId: string, entryData: any) {
    const batch = await this.findOne(sanctionedEntityId);

    const result = await this.dataSource.transaction(async (manager) => {
      return this.createEntryProfile(manager, sanctionedEntityId, entryData);
    });

    // Update entry count
    batch.entriesCount = (batch.entriesCount || 0) + 1;
    await this.sanctionedEntityRepository.save(batch);

    return result;
  }

  /** Update an existing entry */
  async updateEntry(entryId: string, entryData: any) {
    const profileRepo = this.dataSource.getRepository(EntityProfile);
    const profile = await profileRepo.findOne({ where: { id: entryId } });
    if (!profile) {
      throw new NotFoundException('Entry not found');
    }
    Object.assign(profile, {
      fullName: entryData.fullName || profile.fullName,
      nationality: entryData.nationality || profile.nationality,
      dateOfBirth: entryData.dob || profile.dateOfBirth,
      groupId: entryData.groupId || profile.groupId,
      rawData: { ...(profile.rawData || {}), ...entryData },
    });
    return profileRepo.save(profile);
  }

  /** Delete an existing entry */
  async deleteEntry(entryId: string) {
    const profileRepo = this.dataSource.getRepository(EntityProfile);
    const profile = await profileRepo.findOne({
      where: { id: entryId },
      relations: ['sanctionedEntity'],
    });
    if (!profile) {
      throw new NotFoundException('Entry not found');
    }

    const batchId = profile.sanctionedEntityId;
    await profileRepo.softDelete(entryId);

    // Update entry count
    const batch = await this.findOne(batchId);
    batch.entriesCount = Math.max(0, (batch.entriesCount || 1) - 1);
    await this.sanctionedEntityRepository.save(batch);

    return { deleted: true };
  }

  // ─────────────────────────────────────────────────────
  //  BULK — Excel upload & manual batch
  // ─────────────────────────────────────────────────────

  private loadXlsx() {
    try {
      return require('xlsx');
    } catch {
      throw new BadRequestException(
        'Excel upload is unavailable because the xlsx package is not installed.',
      );
    }
  }

  async processUploadedFile(file: UploadedFile, metadata: any) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const format = this.detectUploadFormat(file);
    let rows: any[] = [];

    switch (format) {
      case 'excel':
        rows = this.parseExcelRows(file);
        break;
      case 'xml':
        rows = this.parseXmlRows(file);
        break;
      case 'hmt':
        rows = this.parseHmtRows(file);
        break;
      case 'pdf':
        rows = this.parsePdfRows(file);
        break;
      default:
        throw new BadRequestException('Unsupported upload format');
    }

    const normalizedRows = rows
      .map((row) => this.normalizeImportedRow(row))
      .filter((row) => this.rowHasContent(row));

    if (!normalizedRows.length) {
      throw new BadRequestException(
        `No structured entries could be extracted from ${file.originalname}`,
      );
    }

    return this.createBatchFromRows(normalizedRows, metadata, file.originalname);
  }

  async processExcelUpload(file: UploadedFile, metadata: any) {
    return this.processUploadedFile(file, metadata);
  }

  private async createBatchFromRows(rows: any[], metadata: any, originalName?: string) {
    const normalizedStatus = this.normalizeStatus(
      metadata.status || BlacklistStatusEnum.READY,
    );

    const saved = await this.dataSource.transaction(async (manager) => {
      const batch = manager.create(SanctionedEntity, {
        source: String(metadata.source || originalName || 'Uploaded File'),
        blacklistId: String(metadata.blacklistId || 'N/A'),
        status: normalizedStatus,
        date: new Date().toISOString().split('T')[0],
        entriesCount: rows.length,
        createdById: metadata.createdById || null,
      });
      const savedBatch = await manager.save(batch);

      try {
        for (const row of rows) {
          await this.createEntryProfile(manager, savedBatch.id, row);
        }
      } catch (error) {
        const err = error as Error;
        this.logger.error(`Error processing uploaded file: ${err.message}`, err.stack);
        throw new BadRequestException(`Upload failed: ${err.message}`);
      }

      return savedBatch;
    });

    await this.auditLogService.log({
      action: AuditActionEnum.SANCTIONED_ENTITY_CREATED,
      entityType: 'SanctionedEntity',
      entityId: saved.id,
      metadata: { count: rows.length, source: metadata.source, originalName },
    });

    return saved;
  }

  private detectUploadFormat(file: UploadedFile): UploadFormat {
    const lower = file.originalname.toLowerCase();
    if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
      return 'excel';
    }
    if (lower.endsWith('.xml')) {
      return 'xml';
    }
    if (lower.endsWith('.hmt') || lower.endsWith('.html') || lower.endsWith('.htm')) {
      return 'hmt';
    }
    if (lower.endsWith('.pdf')) {
      return 'pdf';
    }

    const mime = file.mimetype.toLowerCase();
    if (mime.includes('sheet') || mime.includes('excel')) {
      return 'excel';
    }
    if (mime.includes('xml')) {
      return 'xml';
    }
    if (mime.includes('html')) {
      return 'hmt';
    }
    if (mime.includes('pdf')) {
      return 'pdf';
    }

    throw new BadRequestException(
      `Unsupported file type for ${file.originalname}. Supported formats: Excel, XML, HMT/HTML, PDF.`,
    );
  }

  private parseExcelRows(file: UploadedFile) {
    const xlsx = this.loadXlsx();
    const workbook = xlsx.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const datasheet = workbook.Sheets[sheetName];
    return xlsx.utils.sheet_to_json(datasheet);
  }

  private parseXmlRows(file: UploadedFile) {
    const content = file.buffer.toString('utf8');
    return this.extractStructuredRowsFromMarkup(content);
  }

  private parseHmtRows(file: UploadedFile) {
    const content = file.buffer.toString('utf8');
    return this.extractStructuredRowsFromMarkup(content);
  }

  private parsePdfRows(file: UploadedFile) {
    const text = this.extractTextFromPdf(file.buffer);
    const rows = this.parseStructuredTextRows(text);
    if (rows.length) {
      return rows;
    }

    return [
      {
        fullName: this.extractFirstMeaningfulLine(text) || file.originalname,
        otherInfo: text.slice(0, 4000),
      },
    ];
  }

  private extractStructuredRowsFromMarkup(content: string) {
    if (/<table[\s>]/i.test(content)) {
      const tableRows = this.parseHtmlTableRows(content);
      if (tableRows.length) {
        return tableRows;
      }
    }

    const xmlRows = this.parseXmlEntryRows(content);
    if (xmlRows.length) {
      return xmlRows;
    }

    const textRows = this.parseStructuredTextRows(this.stripMarkup(content));
    if (textRows.length) {
      return textRows;
    }

    return [];
  }

  private parseHtmlTableRows(content: string) {
    const rowMatches = [...content.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
    if (rowMatches.length < 2) {
      return [];
    }

    const parsedRows = rowMatches.map((match) => {
      const cells = [...match[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)];
      return cells.map((cell) => this.cleanMarkupText(cell[1]));
    });

    const headers = parsedRows[0];
    const dataRows = parsedRows.slice(1).filter((row) =>
      row.some((cell) => cell && cell.trim().length > 0),
    );

    return dataRows.map((row) => {
      const obj: Record<string, string> = {};
      headers.forEach((header, index) => {
        const key = header || `column_${index + 1}`;
        obj[key] = row[index] || '';
      });
      return obj;
    });
  }

  private parseXmlEntryRows(content: string) {
    const candidateTags = ['record', 'entry', 'individual', 'entity', 'item', 'person'];
    const lower = content.toLowerCase();
    const repeatedTag =
      candidateTags.find((tag) => {
        const count = (lower.match(new RegExp(`<${tag}\\b`, 'g')) || []).length;
        return count > 1;
      }) || 'record';

    const entryMatches = [
      ...content.matchAll(
        new RegExp(`<${repeatedTag}\\b[^>]*>([\\s\\S]*?)<\\/${repeatedTag}>`, 'gi'),
      ),
    ];

    return entryMatches
      .map((match) => {
        const entry: Record<string, string> = {};
        const fieldMatches = [
          ...match[1].matchAll(/<([a-zA-Z0-9_:-]+)\b[^>]*>([\s\S]*?)<\/\1>/g),
        ];

        for (const fieldMatch of fieldMatches) {
          const key = fieldMatch[1];
          const value = this.cleanMarkupText(fieldMatch[2]);
          if (!/<[a-zA-Z]/.test(fieldMatch[2]) && value) {
            entry[key] = value;
          }
        }

        return entry;
      })
      .filter((entry) => Object.keys(entry).length > 0);
  }

  private parseStructuredTextRows(text: string) {
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => line.length > 1);

    const rows: Record<string, string>[] = [];
    let current: Record<string, string> = {};

    for (const line of lines) {
      const parsed = line.match(/^([A-Za-z][A-Za-z0-9 /_-]{1,40})\s*[:\-]\s*(.+)$/);
      if (parsed) {
        const rawKey = parsed[1].trim();
        const value = parsed[2].trim();
        const normalizedKey = this.normalizeFieldKey(rawKey);

        if (
          current.fullName &&
          ['fullname', 'name1', 'groupid'].includes(normalizedKey)
        ) {
          rows.push(current);
          current = {};
        }

        current[rawKey] = value;
        continue;
      }

      if (!current.fullName && !current['Full Name'] && !current['Name']) {
        current['Full Name'] = line;
      } else {
        current['Other Information'] = current['Other Information']
          ? `${current['Other Information']} ${line}`
          : line;
      }
    }

    if (Object.keys(current).length > 0) {
      rows.push(current);
    }

    return rows;
  }

  private extractTextFromPdf(buffer: Buffer) {
    const binary = buffer.toString('latin1');
    const textChunks: string[] = [];

    for (const match of binary.matchAll(/\(([^()]*(?:\\.[^()]*)*)\)\s*Tj/g)) {
      const value = this.decodePdfString(match[1]);
      if (value.trim()) {
        textChunks.push(value);
      }
    }

    for (const match of binary.matchAll(/\[(.*?)\]\s*TJ/gs)) {
      const group = match[1];
      for (const part of group.matchAll(/\(([^()]*(?:\\.[^()]*)*)\)/g)) {
        const value = this.decodePdfString(part[1]);
        if (value.trim()) {
          textChunks.push(value);
        }
      }
    }

    if (!textChunks.length) {
      const fallbackChunks = binary.match(/[A-Za-z0-9][A-Za-z0-9 ,.:;/'"()_-]{4,}/g) || [];
      textChunks.push(...fallbackChunks);
    }

    return textChunks
      .map((chunk) => chunk.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join('\n');
  }

  private decodePdfString(value: string) {
    return value
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\\(/g, '(')
      .replace(/\\\)/g, ')')
      .replace(/\\\\/g, '\\')
      .replace(/\\([0-7]{3})/g, (_, octal) =>
        String.fromCharCode(parseInt(octal, 8)),
      );
  }

  private normalizeImportedRow(row: Record<string, any>) {
    const normalized = this.normalizeObjectKeys(row);
    const address1 =
      this.pickValue(normalized, ['addr1', 'address1', 'address', 'location']) || '';
    const address2 = this.pickValue(normalized, ['addr2', 'address2']) || '';
    const address3 = this.pickValue(normalized, ['addr3', 'address3']) || '';
    const name1 = this.pickValue(normalized, ['name1']);
    const name2 = this.pickValue(normalized, ['name2']);
    const name3 = this.pickValue(normalized, ['name3']);
    const name4 = this.pickValue(normalized, ['name4']);
    const name5 = this.pickValue(normalized, ['name5']);
    const name6 = this.pickValue(normalized, ['name6']);
    const emitter = this.pickValue(normalized, ['emetteur', 'emitter', 'issuer']);
    const requisitionId = this.pickValue(normalized, [
      'idrequisition',
      'requisitionid',
      'requestid',
    ]);
    const requisitionDate = this.parseExcelDate(
      this.pickValue(normalized, ['daterequisition', 'requisitiondate']),
    );
    const notes = this.pickValue(normalized, [
      'otherinformation',
      'otherinfo',
      'notes',
    ]);
    const otherInfo = [
      notes,
      emitter ? `Emitter: ${emitter}` : null,
      requisitionId ? `Requisition ID: ${requisitionId}` : null,
      requisitionDate ? `Requisition Date: ${requisitionDate}` : null,
    ]
      .filter(Boolean)
      .join(' | ');

    const fullName =
      this.pickValue(normalized, ['fullname', 'name', 'primaryname']) ||
      [name1, name2, name3, name4, name5, name6]
        .filter(Boolean)
        .join(' ')
        .trim();

    return {
      fullName: fullName || undefined,
      alias:
        this.pickValue(normalized, ['alias', 'aka', 'aliasname']) || null,
      dob: this.parseExcelDate(
        this.pickValue(normalized, ['dob', 'dateofbirth', 'datenaissance']),
      ),
      nationality:
        this.pickValue(normalized, ['nationality']) ||
        this.pickValue(normalized, ['country']) ||
        null,
      placeOfBirth:
        this.pickValue(normalized, ['placeofbirth', 'townofbirth', 'lieunaissance']) ||
        null,
      townOfBirth:
        this.pickValue(normalized, ['townofbirth', 'placeofbirth', 'lieunaissance']) ||
        null,
      countryOfBirth:
        this.pickValue(normalized, ['countryofbirth']) || null,
      addresses: [address1, address2, address3].filter(Boolean),
      groupId:
        this.pickValue(normalized, ['groupid', 'group']) || null,
      listedOn: this.parseExcelDate(
        this.pickValue(normalized, [
          'listedon',
          'uksanctionslistdate',
          'daterequisition',
          'requisitiondate',
        ]),
      ),
      otherInfo: otherInfo || null,
      passportNum:
        this.pickValue(normalized, ['passportnumber', 'passportnum']) || null,
      nationalId:
        this.pickValue(normalized, ['nationalid', 'nationalidnumber']) || null,
      name1: name1 || fullName || null,
      name2: name2 || null,
      name3: name3 || null,
      name4: name4 || null,
      name5: name5 || null,
      name6: name6 || null,
      title: this.pickValue(normalized, ['title']) || null,
      nameNonLatin:
        this.pickValue(normalized, ['namenonlatinscript', 'namenonlatin']) || null,
      nonLatinType:
        this.pickValue(normalized, ['nonlatintype', 'namenonlatintype']) || null,
      nonLatinLang:
        this.pickValue(normalized, ['nonlatinlang', 'namenonlatinlang']) || null,
      country: this.pickValue(normalized, ['country']) || null,
      groupType:
        this.pickValue(normalized, ['grouptype', 'type', 'typeclient']) || null,
      aliasType: this.pickValue(normalized, ['aliastype']) || null,
      regime: this.pickValue(normalized, ['regime', 'operation']) || null,
      addr1: address1 || null,
      addr2: address2 || null,
      addr3: address3 || null,
      addr4:
        this.pickValue(normalized, ['addr4', 'city', 'address4']) || null,
      addr5:
        this.pickValue(normalized, ['addr5', 'state', 'province', 'address5']) ||
        null,
      addr6: this.pickValue(normalized, ['addr6', 'address6']) || null,
      zipCode:
        this.pickValue(normalized, ['zipcode', 'postalcode', 'postcode']) || null,
    };
  }

  private normalizeObjectKeys(row: Record<string, any>) {
    return Object.entries(row || {}).reduce<Record<string, any>>((acc, [key, value]) => {
      const normalizedKey = this.normalizeFieldKey(key);
      acc[normalizedKey] = typeof value === 'string' ? value.trim() : value;
      return acc;
    }, {});
  }

  private normalizeFieldKey(key: string) {
    return String(key).replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  }

  private pickValue(row: Record<string, any>, keys: string[]) {
    for (const key of keys) {
      const value = row[this.normalizeFieldKey(key)];
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        return value;
      }
    }
    return null;
  }

  private cleanMarkupText(value: string) {
    return this.decodeHtmlEntities(
      value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
    );
  }

  private stripMarkup(value: string) {
    return this.decodeHtmlEntities(value.replace(/<[^>]+>/g, '\n'));
  }

  private decodeHtmlEntities(value: string) {
    return value
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'");
  }

  private rowHasContent(row: Record<string, any>) {
    return Object.values(row).some(
      (value) => value !== null && value !== undefined && String(value).trim() !== '',
    );
  }

  private extractFirstMeaningfulLine(text: string) {
    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 2);
  }

  private normalizeStatus(status: string): BlacklistStatusEnum {
    const upper = String(status).toUpperCase();
    if (Object.values(BlacklistStatusEnum).includes(upper as BlacklistStatusEnum)) {
      return upper as BlacklistStatusEnum;
    }
    return BlacklistStatusEnum.READY;
  }

  async bulkCreate(payload: { source: string; blacklistId?: string; entries: any[]; createdById?: string }) {
    const { source, blacklistId, entries, createdById } = payload;

    const saved = await this.dataSource.transaction(async (manager) => {
      // 1. Create ONE batch (SanctionedEntity)
      const batch = manager.create(SanctionedEntity, {
        source: String(source),
        blacklistId: blacklistId || null,
        status: BlacklistStatusEnum.READY,
        date: new Date().toISOString().split('T')[0],
        entriesCount: entries.length,
        createdById: createdById || null,
      });
      const savedBatch = await manager.save(batch);

      // 2. Create entries inside it
      try {
        for (const entryData of entries) {
          await this.createEntryProfile(manager, savedBatch.id, entryData);
        }
      } catch (error) {
        this.logger.error(`Error processing bulk create: ${error.message}`, error.stack);
        throw new BadRequestException(`Bulk create failed: ${error.message}`);
      }

      return savedBatch;
    });

    await this.auditLogService.log({
      action: AuditActionEnum.SANCTIONED_ENTITY_CREATED,
      entityType: 'SanctionedEntity',
      entityId: saved.id,
      metadata: { count: entries.length, source, blacklistId },
    });

    return saved;
  }

  // ─────────────────────────────────────────────────────
  //  STATS
  // ─────────────────────────────────────────────────────

  async getStats() {
    const totalBlacklists = await this.sanctionedEntityRepository.count();

    const profileRepo = this.dataSource.getRepository(EntityProfile);
    const totalEntries = await profileRepo.count();

    return {
      totalBlacklists,
      totalEntries,
      activeUsers: 3,
      recentActivity: 15,
    };
  }

  // ─────────────────────────────────────────────────────
  //  PRIVATE HELPERS
  // ─────────────────────────────────────────────────────

  /**
   * Creates a single entry (EntityProfile + names + DOB + address + individual profile)
   * inside the given batch (sanctionedEntityId), within the given transaction manager
   */
  private async createEntryProfile(
    manager: EntityManager,
    sanctionedEntityId: string,
    data: any,
  ): Promise<EntityProfile> {
    // Build fullName from name parts if not directly provided
    const fullName = data.fullName
      || [data.name1, data.name2, data.name3, data.name4, data.name5, data.name6]
          .filter((n: string) => n && String(n).trim())
          .join(' ')
      || 'Unknown';
    const primaryDisplayName = data.name1 || fullName;

    // Build a sanitized rawData snapshot preserving every original field
    const rawData: Record<string, any> = {
      name1: primaryDisplayName || '', name2: data.name2 || '', name3: data.name3 || '',
      name4: data.name4 || '', name5: data.name5 || '', name6: data.name6 || '',
      title: data.title || '',
      nameNonLatin: data.nameNonLatin || '', nonLatinType: data.nonLatinType || '', nonLatinLang: data.nonLatinLang || '',
      dob: data.dob ? String(data.dob) : '',
      townOfBirth: data.townOfBirth || data.placeOfBirth || '',
      countryOfBirth: data.countryOfBirth || '',
      nationality: data.nationality || data.country || '',
      passportNum: data.passportNum || data.passportNumber || '',
      passportDetails: data.passportDetails || '',
      nationalId: data.nationalId || data.nationalIdNumber || '',
      nationalIdDetails: data.nationalIdDetails || '',
      addr1: data.addr1 || (data.addresses?.[0]) || '',
      addr2: data.addr2 || (data.addresses?.[1]) || '',
      addr3: data.addr3 || (data.addresses?.[2]) || '',
      addr4: data.addr4 || '', addr5: data.addr5 || '', addr6: data.addr6 || '',
      zipCode: data.zipCode || '',
      country: data.country || '',
      otherInfo: data.otherInfo || data.otherInformation || '',
      groupType: data.groupType || '',
      aliasType: data.aliasType || data.alias || '',
      aliasQuality: data.aliasQuality || '',
      regime: data.regime || '',
      listedOn: data.listedOn || '',
      ukSanctionsListDate: data.ukSanctionsListDate || '',
      lastUpdated: data.lastUpdated || '',
      groupId: data.groupId || '',
      fullName,
    };

    // 1. EntityProfile (the "entry" / person row)
    const profile = manager.create(EntityProfile, {
      sanctionedEntityId,
      entityType: this.mapGroupType(data.groupType),
      fullName: String(fullName),
      alias: data.alias || data.aliasType || null,
      dateOfBirth: data.dob ? String(data.dob) : null,
      nationality: data.nationality || data.country || null,
      groupId: data.groupId ? parseInt(String(data.groupId), 10) || null : null,
      listedOn: data.listedOn || data.ukSanctionsListDate || null,
      otherInformation: data.otherInfo || data.otherInformation || null,
      rawData,
    });
    const savedProfile = await manager.save(profile);

    // 2. Primary Name
    const primaryName = manager.create(EntityName, {
      entityProfileId: savedProfile.id,
      name: String(fullName),
      nameType: NameTypeEnum.PRIMARY_NAME,
      isPrimary: true,
    });
    await manager.save(primaryName);

    // 3. Alias name
    const aliasValue = data.alias || data.aliasType;
    if (aliasValue) {
      const aliasName = manager.create(EntityName, {
        entityProfileId: savedProfile.id,
        name: String(aliasValue),
        nameType: NameTypeEnum.AKA,
        isPrimary: false,
      });
      await manager.save(aliasName);
    }

    // 4. Non-Latin name
    if (data.nameNonLatin) {
      const nlName = manager.create(EntityName, {
        entityProfileId: savedProfile.id,
        name: String(data.nameNonLatin),
        nameType: NameTypeEnum.PRIMARY_NAME_VARIATION,
        isPrimary: false,
      });
      await manager.save(nlName);
    }

    // 5. Date of Birth
    const dob = data.dob || data.dateOfBirth;
    if (dob) {
      const dobEntry = manager.create(EntityDateOfBirth, {
        entityProfileId: savedProfile.id,
        dateOfBirth: String(dob),
      });
      await manager.save(dobEntry);
    }

    // 6. Individual Profile (demographics)
    const nat = data.nationality || data.country;
    const pob = data.placeOfBirth || data.townOfBirth || data.countryOfBirth;
    const passport = data.passportNum || data.passportNumber;
    const natId = data.nationalId || data.nationalIdNumber;
    if (nat || pob || passport || natId) {
      const indProfile = manager.create(IndividualProfile, {
        entityProfileId: savedProfile.id,
        nationality: nat ? String(nat) : null,
        placeOfBirth: pob ? String(pob) : null,
        passportNumber: passport ? String(passport) : null,
        passportDetails: data.passportDetails ? String(data.passportDetails) : null,
        nationalIdNumber: natId ? String(natId) : null,
        nationalIdDetails: data.nationalIdDetails ? String(data.nationalIdDetails) : null,
      });
      await manager.save(indProfile);
    }

    // 7. Address
    const addrFields = [data.addr1, data.addr2, data.addr3, data.addr4, data.addr5, data.addr6];
    const validAddrs = (data.addresses || addrFields).filter(
      (a: string) => a && String(a).trim().length > 0,
    );
    if (validAddrs.length > 0) {
      const address = manager.create(EntityAddress, {
        entityProfileId: savedProfile.id,
        addressType: AddressTypeEnum.CORRESPONDENCE,
        addressLine1: String(validAddrs[0]),
        addressLine2: validAddrs[1] ? String(validAddrs[1]) : null,
        addressLine3: validAddrs[2] ? String(validAddrs[2]) : null,
        city: validAddrs[3] ? String(validAddrs[3]) : null,
        state: validAddrs[4] ? String(validAddrs[4]) : null,
        postalCode: data.zipCode ? String(data.zipCode) : null,
        country: (data.country || nat) ? String(data.country || nat) : null,
      });
      await manager.save(address);
    }

    return savedProfile;
  }

  /** Map frontend groupType string to EntityTypeEnum */
  private mapGroupType(groupType?: string): EntityTypeEnum {
    if (!groupType) return EntityTypeEnum.INDIVIDUAL;
    const upper = String(groupType).toUpperCase();
    if (upper.includes('ORG') || upper.includes('ENTITY')) return EntityTypeEnum.ORGANIZATION;
    if (upper.includes('MORAL')) return EntityTypeEnum.ORGANIZATION;
    if (upper.includes('PHYSIQUE')) return EntityTypeEnum.INDIVIDUAL;
    if (upper.includes('VESSEL') || upper.includes('SHIP')) return EntityTypeEnum.VESSEL;
    return EntityTypeEnum.INDIVIDUAL;
  }

  /** Convert Excel serial date numbers (e.g. 43753) to ISO date strings, or pass strings through */
  private parseExcelDate(value: any): string | null {
    if (!value) return null;
    if (typeof value === 'number') {
      // Excel serial date: days since 1900-01-00 (with the 1900 leap year bug)
      const excelEpoch = new Date(1899, 11, 30); // Dec 30, 1899
      const date = new Date(excelEpoch.getTime() + value * 86400000);
      return date.toISOString().split('T')[0];
    }
    const normalized = String(value).trim();
    if (/^\d{8}$/.test(normalized)) {
      return `${normalized.slice(0, 4)}-${normalized.slice(4, 6)}-${normalized.slice(6, 8)}`;
    }
    return normalized;
  }

  /** Flatten an EntityProfile + relations into the flat column format the frontend ViewEntriesModal expects */
  private flattenProfile(p: EntityProfile): Record<string, any> {
    const raw = p.rawData || {} as Record<string, any>;

    // If rawData exists, use it directly — it preserves exact column positions
    // Otherwise fall back to relational data
    const ind = p.individualProfile;
    const addr = p.addresses?.[0];
    const dob = p.datesOfBirth?.[0];
    const aliasName = p.names?.find((n) => n.nameType === NameTypeEnum.AKA);
    const nlName = p.names?.find((n) => n.nameType === NameTypeEnum.PRIMARY_NAME_VARIATION);

    return {
      id: p.id,
      name1: raw.name1 || raw.fullName || p.fullName || '',
      name2: raw.name2 || '',
      name3: raw.name3 || '',
      name4: raw.name4 || '',
      name5: raw.name5 || '',
      name6: raw.name6 || '',
      title: raw.title || '',
      nameNonLatin: raw.nameNonLatin || nlName?.name || '',
      nonLatinType: raw.nonLatinType || '',
      nonLatinLang: raw.nonLatinLang || '',
      dob: raw.dob || dob?.dateOfBirth || p.dateOfBirth || '',
      townOfBirth: raw.townOfBirth || ind?.placeOfBirth || '',
      countryOfBirth: raw.countryOfBirth || '',
      nationality: raw.nationality || ind?.nationality || p.nationality || '',
      passportNum: raw.passportNum || ind?.passportNumber || '',
      passportDetails: raw.passportDetails || ind?.passportDetails || '',
      nationalId: raw.nationalId || ind?.nationalIdNumber || '',
      nationalIdDetails: raw.nationalIdDetails || ind?.nationalIdDetails || '',
      addr1: raw.addr1 || addr?.addressLine1 || '',
      addr2: raw.addr2 || addr?.addressLine2 || '',
      addr3: raw.addr3 || addr?.addressLine3 || '',
      addr4: raw.addr4 || addr?.city || '',
      addr5: raw.addr5 || addr?.state || '',
      addr6: raw.addr6 || '',
      zipCode: raw.zipCode || addr?.postalCode || '',
      country: raw.country || addr?.country || '',
      otherInfo: raw.otherInfo || p.otherInformation || '',
      groupType: raw.groupType || p.entityType || '',
      aliasType: raw.aliasType || aliasName?.name || p.alias || '',
      aliasQuality: raw.aliasQuality || '',
      regime: raw.regime || '',
      listedOn: raw.listedOn || p.listedOn || '',
      ukSanctionsListDate: raw.ukSanctionsListDate || '',
      lastUpdated: raw.lastUpdated || p.updatedAt?.toISOString?.()?.split('T')?.[0] || '',
      groupId: raw.groupId || p.groupId || '',
      fullName: raw.fullName || p.fullName || '',
      evidenceDocuments: p.evidenceDocuments || [],
      errors: raw.errors || [],
    };
  }

  private assertValidStatusTransition(
    current: BlacklistStatusEnum,
    next: BlacklistStatusEnum,
  ) {
    const allowedTransitions: Record<
      BlacklistStatusEnum,
      BlacklistStatusEnum[]
    > = {
      [BlacklistStatusEnum.PENDING]: [
        BlacklistStatusEnum.READY,
        BlacklistStatusEnum.PROCESSING,
      ],
      [BlacklistStatusEnum.READY]: [
        BlacklistStatusEnum.VALID,
        BlacklistStatusEnum.ERRONEOUS,
        BlacklistStatusEnum.PROCESSING,
      ],
      [BlacklistStatusEnum.PROCESSING]: [
        BlacklistStatusEnum.VALID,
        BlacklistStatusEnum.ERRONEOUS,
      ],
      [BlacklistStatusEnum.VALID]: [
        BlacklistStatusEnum.ERRONEOUS,
        BlacklistStatusEnum.READY,
      ],
      [BlacklistStatusEnum.ERRONEOUS]: [
        BlacklistStatusEnum.VALID,
        BlacklistStatusEnum.READY,
      ],
    };

    const allowed = allowedTransitions[current] || [];
    if (!allowed.includes(next)) {
      throw new BadRequestException(
        `Invalid status transition: ${current} -> ${next}`,
      );
    }
  }
}
