import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ReviewDecisionEnum } from '../../common/enums/review-decision.enum';

export class CreateReviewDto {
  @IsUUID()
  sanctionedEntityId: string;

  @IsUUID()
  @IsOptional()
  reviewerId: string;

  @IsEnum(ReviewDecisionEnum)
  decision: ReviewDecisionEnum;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  comment?: string;
}
