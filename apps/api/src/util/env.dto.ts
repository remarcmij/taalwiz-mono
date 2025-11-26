import { IsEmail, IsNotEmpty, IsNumberString } from 'class-validator';

export class EnvDto {
  private static instance: EnvDto;

  @IsNotEmpty()
  nodeEnv = process.env.NODE_ENV!;

  @IsNotEmpty()
  mongoUrl = process.env.MONGO_URL!;

  @IsNotEmpty()
  siteName = process.env.SITE_NAME!;

  @IsNotEmpty()
  hostUrl = process.env.HOST_URL!;

  @IsNotEmpty()
  smtpHost = process.env.SMTP_HOST!;

  @IsNotEmpty()
  @IsNumberString()
  smtpPort = process.env.SMTP_PORT!;

  @IsNotEmpty()
  smtpUser = process.env.SMTP_USER!;

  @IsNotEmpty()
  smtpPassword = process.env.SMTP_PASSWORD!;

  @IsEmail()
  adminEmail = process.env.ADMIN_EMAIL!;

  @IsNotEmpty()
  adminPassword = process.env.ADMIN_PASSWORD!;

  @IsEmail()
  demoEmail = process.env.DEMO_EMAIL!;

  @IsNotEmpty()
  demoPassword = process.env.DEMO_PASSWORD!;

  @IsNotEmpty()
  custodianName = process.env.CUSTODIAN_NAME!;

  @IsEmail()
  custodianEmail = process.env.CUSTODIAN_EMAIL!;

  @IsNotEmpty()
  jwtSecret = process.env.JWT_SECRET!;

  @IsNotEmpty()
  jwtRefreshSecret = process.env.JWT_REFRESH_SECRET!;

  private constructor() {}

  static getInstance(): EnvDto {
    if (!EnvDto.instance) {
      EnvDto.instance = new EnvDto();
    }
    return EnvDto.instance;
  }
}
