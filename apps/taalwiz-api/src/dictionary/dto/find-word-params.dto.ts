import { IsEnum, MinLength } from 'class-validator';

export class FindWordParamsDto {
  @MinLength(2)
  word = '';

  @IsEnum(['id', 'nl'], { message: "lang must be either 'id' or 'nl'" })
  lang = '';
}
