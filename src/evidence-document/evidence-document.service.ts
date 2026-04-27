import { Injectable, NotFoundException } from '@nestjs/common';
import { EvidenceDocumentRepository } from './evidence-document.repository';
import { CreateEvidenceDocumentDto } from './dto/create-evidence-document.dto';
import { UpdateEvidenceDocumentDto } from './dto/update-evidence-document.dto';
import * as fs from 'fs';
import * as path from 'path';

type UploadedFile = {
  originalname: string;
  buffer: Buffer;
  mimetype: string;
  size: number;
};

@Injectable()
export class EvidenceDocumentService {
  constructor(
    private readonly evidenceDocumentRepository: EvidenceDocumentRepository,
  ) {}

  async handleUpload(entityId: string, file: UploadedFile) {
    const uploadDir = path.join(__dirname, '..', '..', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const safeOriginalName = path
      .basename(file.originalname)
      .replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = `${Date.now()}-${safeOriginalName}`;
    const filePath = path.join(uploadDir, filename);
    fs.writeFileSync(filePath, file.buffer);

    const document = this.evidenceDocumentRepository.create({
      originalName: safeOriginalName,
      storagePath: `/uploads/${filename}`,
      sanctionedEntityId: entityId,
      mimeType: file.mimetype,
      sizeBytes: file.size,
    });

    return this.evidenceDocumentRepository.save(document);
  }

  create(createEvidenceDocumentDto: CreateEvidenceDocumentDto) {
    const document = this.evidenceDocumentRepository.create(
      createEvidenceDocumentDto,
    );
    return this.evidenceDocumentRepository.save(document);
  }

  findAll() {
    return this.evidenceDocumentRepository.find();
  }

  async findOne(id: string) {
    const document = await this.evidenceDocumentRepository.findOne({
      where: { id },
    });
    if (!document) {
      throw new NotFoundException('Evidence document not found');
    }
    return document;
  }

  async update(
    id: string,
    updateEvidenceDocumentDto: UpdateEvidenceDocumentDto,
  ) {
    const document = await this.evidenceDocumentRepository.preload({
      id,
      ...updateEvidenceDocumentDto,
    });
    if (!document) {
      throw new NotFoundException('Evidence document not found');
    }
    return this.evidenceDocumentRepository.save(document);
  }

  async remove(id: string) {
    const document = await this.findOne(id);
    await this.evidenceDocumentRepository.remove(document);
    return { deleted: true };
  }
}
