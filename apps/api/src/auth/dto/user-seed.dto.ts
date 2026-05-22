import { IsEmail, IsIn, IsNotEmpty, IsString } from 'class-validator';
import type { Language, Role } from '../../users/models/user.model.js';

const ALLOWED_ROLES = ['admin', 'user', 'demo'];
const ALLOWED_LANGUAGES = ['en', 'nl'];

export class UserSeedDto {
  @IsString()
  @IsNotEmpty()
  name = '';

  @IsEmail()
  email = '';

  @IsString()
  @IsNotEmpty()
  password = '';

  @IsString({ each: true })
  @IsIn(ALLOWED_ROLES, { each: true })
  roles: Role[] = [];

  @IsString()
  @IsIn(ALLOWED_LANGUAGES)
  lang: Language = 'en';
}
