import { IsString, MinLength } from 'class-validator';

export class CreateVocabularyListDto {
  @IsString()
  @MinLength(1)
  name = '';
}
