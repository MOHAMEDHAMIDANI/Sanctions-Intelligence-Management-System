import { Injectable, NotImplementedException } from '@nestjs/common';
import { ExportJobRepository } from './export-job.repository';
import { CreateExportJobDto } from './dto/create-export-job.dto';
import { UpdateExportJobDto } from './dto/update-export-job.dto';

@Injectable()
export class ExportJobService {
  constructor(private readonly exportJobRepository: ExportJobRepository) {}

  create(createExportJobDto: CreateExportJobDto) {
    throw new NotImplementedException('Export jobs are not implemented yet');
  }

  findAll() {
    throw new NotImplementedException('Export jobs are not implemented yet');
  }

  findOne(id: string) {
    throw new NotImplementedException('Export jobs are not implemented yet');
  }

  update(id: string, updateExportJobDto: UpdateExportJobDto) {
    throw new NotImplementedException('Export jobs are not implemented yet');
  }

  remove(id: string) {
    throw new NotImplementedException('Export jobs are not implemented yet');
  }
}
