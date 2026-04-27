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
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { SanctionedEntityService } from './sanctioned-entity.service';
import { CreateSanctionedEntityDto } from './dto/create-sanctioned-entity.dto';
import { UpdateSanctionedEntityDto } from './dto/update-sanctioned-entity.dto';

type UploadedFile = {
  originalname: string;
  buffer: Buffer;
  mimetype: string;
  size: number;
};

@Controller('sanctioned-entity')
export class SanctionedEntityController {
  constructor(
    private readonly sanctionedEntityService: SanctionedEntityService,
  ) {}

  // ── Batch-level CRUD ──

  @Post()
  create(
    @Body() createSanctionedEntityDto: CreateSanctionedEntityDto,
    @Request() req: any,
  ) {
    return this.sanctionedEntityService.create(
      createSanctionedEntityDto,
      req.user.id,
    );
  }

  @Post('bulk')
  @UseGuards(JwtAuthGuard)
  bulkCreate(
    @Body() payload: { source: string; blacklistId?: string; entries: any[] },
    @Request() req: any,
  ) {
    return this.sanctionedEntityService.bulkCreate({
      ...payload,
      createdById: req.user.id,
    });
  }

  @Get('stats')
  getStats() {
    return this.sanctionedEntityService.getStats();
  }

  @Get()
  findAll() {
    return this.sanctionedEntityService.findAll();
  }

  @Get('archived')
  findAllArchived() {
    return this.sanctionedEntityService.findAllArchived();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.sanctionedEntityService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateSanctionedEntityDto: UpdateSanctionedEntityDto,
  ) {
    return this.sanctionedEntityService.update(id, updateSanctionedEntityDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.sanctionedEntityService.remove(id);
  }

  @Patch(':id/restore')
  restore(@Param('id') id: string) {
    return this.sanctionedEntityService.restore(id);
  }

  @Delete(':id/permanent')
  permanentDelete(@Param('id') id: string) {
    return this.sanctionedEntityService.permanentDelete(id);
  }

  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(
    @UploadedFile() file: UploadedFile,
    @Body() metadata: any,
    @Request() req: any,
  ) {
    return this.sanctionedEntityService.processUploadedFile(file, {
      ...metadata,
      createdById: req.user.id,
    });
  }

  // ── Entry-level CRUD (EntityProfile inside a batch) ──

  @Get(':id/entries')
  getEntries(@Param('id') id: string) {
    return this.sanctionedEntityService.getEntries(id);
  }

  @Post(':id/entries')
  addEntry(@Param('id') id: string, @Body() entryData: any) {
    return this.sanctionedEntityService.addEntry(id, entryData);
  }

  @Patch('entries/:entryId')
  updateEntry(@Param('entryId') entryId: string, @Body() entryData: any) {
    return this.sanctionedEntityService.updateEntry(entryId, entryData);
  }

  @Delete('entries/:entryId')
  deleteEntry(@Param('entryId') entryId: string) {
    return this.sanctionedEntityService.deleteEntry(entryId);
  }
}
