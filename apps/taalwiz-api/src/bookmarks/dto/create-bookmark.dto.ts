import { IsString, MinLength } from 'class-validator';

export class CreateBookmarkDto {
  @IsString()
  @MinLength(1)
  word = '';

  @IsString()
  @MinLength(1)
  lang = '';

  @IsString()
  @MinLength(1)
  listId = '';
}
