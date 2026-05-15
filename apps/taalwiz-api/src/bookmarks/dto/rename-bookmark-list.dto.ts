import { IsString, MinLength } from 'class-validator';

export class RenameBookmarkListDto {
  @IsString()
  @MinLength(1)
  name = '';
}
