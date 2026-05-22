import { IsEmail, MinLength } from 'class-validator';

export class SignInDto {
  @IsEmail()
  email = '';

  @MinLength(6)
  password = '';
}
