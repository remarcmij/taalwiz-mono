import { IsEnum } from 'class-validator';

export class UpdateLangDto {
  @IsEnum(['en', 'nl'])
  lang = 'nl';
}
