import { IsEmail, IsNotEmpty } from 'class-validator';

export class EmailTokenDto {
  @IsEmail()
  email = '';

  @IsNotEmpty()
  token = '';
}
