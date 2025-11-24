import { IsEmail, IsEnum } from 'class-validator';

export class EmailLangDto {
  @IsEmail()
  email = '';

  @IsEnum(['en', 'nl'])
  lang = 'nl';
}
