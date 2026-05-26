import { IsString, MinLength } from 'class-validator';

export class AdminSetPasswordDto {
  @IsString()
  @MinLength(6)
  newPassword!: string;
}
