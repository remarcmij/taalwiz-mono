import { IsBoolean } from 'class-validator';

export class SetSuspendedDto {
  @IsBoolean()
  isSuspended = false;
}
