import {
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { EntityTypeEnum } from '../../common/enums/entity-type.enum';
import { ListTypeEnum } from '../../common/enums/list-type.enum';
import { RiskEnum } from '../../common/enums/risk.enum';
import { QualityEnum } from '../../common/enums/quality.enum';

export class CreateEntityProfileDto {
  @IsUUID()
  sanctionedEntityId: string;

  @IsEnum(EntityTypeEnum)
  entityType: EntityTypeEnum;

  @IsOptional()
  @IsEnum(ListTypeEnum)
  listType?: ListTypeEnum;

  @IsOptional()
  @IsEnum(RiskEnum)
  risk?: RiskEnum;

  @IsOptional()
  @IsEnum(QualityEnum)
  quality?: QualityEnum;

  // --- PERSON-LEVEL FIELDS (Allowed but usually managed via rawData) ---
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  alias?: string;

  @IsOptional()
  @IsString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  nationality?: string;

  @IsOptional()
  @IsInt()
  groupId?: number;

  @IsOptional()
  @IsString()
  listedOn?: string;

  @IsOptional()
  @IsString()
  otherInformation?: string;

  @IsOptional()
  @IsObject()
  rawData?: Record<string, unknown>;
}
