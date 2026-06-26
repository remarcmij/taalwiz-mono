import { plainToInstance } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  validateSync,
} from 'class-validator';

export class EnvDto {
  @IsNotEmpty()
  NODE_ENV!: string;

  @IsNotEmpty()
  MONGO_URL!: string;

  // Optional; defaults to 'taalwiz' in main.ts. Set to isolate a second
  // deployment's database on the same MongoDB server.
  @IsOptional()
  @IsNotEmpty()
  MONGO_DB?: string;

  @IsNotEmpty()
  SITE_NAME!: string;

  @IsNotEmpty()
  HOST_URL!: string;

  @IsNotEmpty()
  SMTP_HOST!: string;

  @IsNotEmpty()
  @IsNumberString()
  SMTP_PORT!: string;

  @IsNotEmpty()
  SMTP_USER!: string;

  @IsNotEmpty()
  SMTP_PASSWORD!: string;

  @IsEmail()
  ADMIN_EMAIL!: string;

  @IsNotEmpty()
  ADMIN_PASSWORD!: string;

  @IsEmail()
  DEMO_EMAIL!: string;

  @IsNotEmpty()
  DEMO_PASSWORD!: string;

  @IsNotEmpty()
  CUSTODIAN_NAME!: string;

  @IsEmail()
  CUSTODIAN_EMAIL!: string;

  @IsNotEmpty()
  JWT_SECRET!: string;

  @IsNotEmpty()
  JWT_REFRESH_SECRET!: string;
}

export function validateEnv(config: Record<string, unknown>): EnvDto {
  const validated = plainToInstance(EnvDto, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(`Invalid environment variables:\n${errors.toString()}`);
  }
  return validated;
}
