import { validateSync } from 'class-validator';
import 'dotenv/config';

import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import mongoose from 'mongoose';
import morgan from 'morgan';
import { AppModule } from './app.module.js';
import { EnvDto } from './util/env.dto.js';

async function bootstrap() {
  const env = EnvDto.getInstance();
  const errors = validateSync(env, { skipMissingProperties: false });
  if (errors.length > 0) {
    console.error('❌  Invalid environment variables:', errors);
    process.exit(1);
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors();

  if (env.nodeEnv === 'development') {
    app.use(morgan('dev'));
  }

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      enableDebugMessages: true,
    }),
  );

  await mongoose.connect(env.mongoUrl!, {
    dbName: 'taalwiz',
  });

  const logger = new Logger('Bootstrap');
  logger.log('Connected to database');

  await app.listen(process.env.PORT ?? 3000);
}

await bootstrap();
