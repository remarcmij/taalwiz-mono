import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CreateVocabularyItemDto {
  @IsString()
  @MinLength(1)
  term = '';

  @IsString()
  @MinLength(1)
  lang = '';

  @IsString()
  @MinLength(1)
  listId = '';

  @IsOptional()
  @IsString()
  back?: string;
}

export class BulkAddVocabularyDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => CreateVocabularyItemDto)
  items: CreateVocabularyItemDto[] = [];
}
