import { IsIn, IsString, MinLength } from 'class-validator';

export class SrsReviewDto {
  @IsString()
  @MinLength(1)
  term = '';

  @IsString()
  @MinLength(1)
  lang = '';

  @IsString()
  @MinLength(1)
  listId = '';

  @IsIn(['again', 'good', 'easy'])
  rating: 'again' | 'good' | 'easy' = 'good';
}
