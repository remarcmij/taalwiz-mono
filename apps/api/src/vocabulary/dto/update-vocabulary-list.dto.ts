import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateVocabularyListDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsBoolean()
  isLocked?: boolean;
}
