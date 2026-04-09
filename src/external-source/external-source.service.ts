import { Injectable, NotImplementedException } from '@nestjs/common';
import { ExternalSourceRepository } from './external-source.repository';
import { CreateExternalSourceDto } from './dto/create-external-source.dto';
import { UpdateExternalSourceDto } from './dto/update-external-source.dto';

@Injectable()
export class ExternalSourceService {
  constructor(
    private readonly externalSourceRepository: ExternalSourceRepository,
  ) {}

  create(createExternalSourceDto: CreateExternalSourceDto) {
    throw new NotImplementedException('External sources are not implemented yet');
  }

  findAll() {
    throw new NotImplementedException('External sources are not implemented yet');
  }

  findOne(id: string) {
    throw new NotImplementedException('External sources are not implemented yet');
  }

  update(id: string, updateExternalSourceDto: UpdateExternalSourceDto) {
    throw new NotImplementedException('External sources are not implemented yet');
  }

  remove(id: string) {
    throw new NotImplementedException('External sources are not implemented yet');
  }
}
