import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { BlacklistStatusEnum } from '../../common/enums/blacklist-status.enum';

export class CreateSanctionedEntityDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  source: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  blacklistId?: string;

  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.toUpperCase() : value)
  @IsEnum(BlacklistStatusEnum)
  status?: BlacklistStatusEnum;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsNumber()
  entriesCount?: number;

  @IsOptional()
  @IsArray()
  @IsObject({ each: true })
  manualData?: Record<string, unknown>[];

  @IsOptional()
  @IsString()
  version?: string;
}
