import { IsIn, IsString, MinLength } from 'class-validator';

export class ReviewSrsCardDto {
  @IsString()
  @MinLength(1)
  word = '';

  @IsString()
  @MinLength(1)
  lang = '';

  @IsString()
  @MinLength(1)
  listId = '';

  @IsIn(['again', 'good', 'easy'])
  rating: 'again' | 'good' | 'easy' = 'good';
}
