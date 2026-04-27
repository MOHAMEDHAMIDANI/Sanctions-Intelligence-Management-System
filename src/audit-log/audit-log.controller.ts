import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('audit-log')
@Roles('admin')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Post()
  create(@Body() createAuditLogDto: CreateAuditLogDto) {
    return this.auditLogService.create(createAuditLogDto);
  }

  @Get()
  findAll(
    @Query('entityId') entityId?: string,
    @Query('entityType') entityType?: string,
    @Query('batchId') batchId?: string,
  ) {
    return this.auditLogService.findAll({ entityId, entityType, batchId });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.auditLogService.findOne(id);
  }
}
