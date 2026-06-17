import { IsInt, IsString, Min, MinLength } from 'class-validator';

export class SrsLemmaIndexDto {
  @IsString()
  @MinLength(1)
  term = '';

  @IsString()
  @MinLength(1)
  lang = '';

  @IsString()
  @MinLength(1)
  listId = '';

  @IsInt()
  @Min(0)
  lemmaIndex = 0;
}
