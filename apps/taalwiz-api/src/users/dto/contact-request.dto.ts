import { IsEmail, IsNotEmpty } from 'class-validator';

export class ContactRequestDto {
  @IsEmail()
  email = '';

  @IsNotEmpty()
  message = '';
}
