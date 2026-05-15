import { IsString, MinLength } from 'class-validator';

export class CreateBookmarkListDto {
  @IsString()
  @MinLength(1)
  name = '';
}
