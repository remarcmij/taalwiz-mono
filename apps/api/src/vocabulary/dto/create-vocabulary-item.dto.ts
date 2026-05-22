import { IsOptional, IsString, MinLength } from 'class-validator';

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
