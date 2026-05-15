import { IsMongoId, IsOptional } from 'class-validator';

export class UpdateUserPreferencesDto {
  @IsMongoId()
  @IsOptional()
  currentBookmarkListId?: string;
}
