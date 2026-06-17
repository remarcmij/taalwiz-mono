import { IsInt, IsMongoId, IsOptional, Max, Min } from 'class-validator';

export class UpdateUserPreferencesDto {
  @IsMongoId()
  @IsOptional()
  currentVocabularyListId?: string;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  newCardsPerDay?: number;
}
