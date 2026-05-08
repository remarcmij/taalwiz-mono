import { IsEmail, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsEmail()
  email = '';

  @MinLength(6)
  password = '';

  @MinLength(6)
  newPassword = '';
}
