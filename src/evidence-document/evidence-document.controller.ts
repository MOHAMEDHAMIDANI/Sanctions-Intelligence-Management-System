import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseInterceptors,
  UploadedFile,
  ParseFilePipeBuilder,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { EvidenceDocumentService } from './evidence-document.service';
import { CreateEvidenceDocumentDto } from './dto/create-evidence-document.dto';
import { UpdateEvidenceDocumentDto } from './dto/update-evidence-document.dto';
import { Roles } from '../auth/decorators/roles.decorator';

type UploadedFile = {
  originalname: string;
  buffer: Buffer;
  mimetype: string;
  size: number;
};

@Controller('evidence-document')
@Roles('admin', 'compliance', 'auditor')
export class EvidenceDocumentController {
  constructor(
    private readonly evidenceDocumentService: EvidenceDocumentService,
  ) {}

  @Post('upload/:entityId')
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(
    @Param('entityId') entityId: string,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addMaxSizeValidator({ maxSize: 10 * 1024 * 1024 })
        .addFileTypeValidator({
          fileType:
            /^(application\/pdf|image\/jpeg|image\/png|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document)$/,
        })
        .build({
          fileIsRequired: true,
        }),
    )
    file: UploadedFile,
  ) {
    return this.evidenceDocumentService.handleUpload(entityId, file);
  }

  @Post()
  create(@Body() createEvidenceDocumentDto: CreateEvidenceDocumentDto) {
    return this.evidenceDocumentService.create(createEvidenceDocumentDto);
  }

  @Get()
  findAll() {
    return this.evidenceDocumentService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.evidenceDocumentService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateEvidenceDocumentDto: UpdateEvidenceDocumentDto,
  ) {
    return this.evidenceDocumentService.update(id, updateEvidenceDocumentDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.evidenceDocumentService.remove(id);
  }
}
