import { IsString, MinLength } from 'class-validator';

export class RenameVocabularyListDto {
  @IsString()
  @MinLength(1)
  name = '';
}
