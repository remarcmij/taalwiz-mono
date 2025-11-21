import 'dotenv/config';

import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import mongoose from 'mongoose';
import morgan from 'morgan';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors();

  if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
  }

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      enableDebugMessages: true,
    }),
  );

  await mongoose.connect(process.env.MONGO_URL!, {
    dbName: 'taalwiz',
  });

  const logger = new Logger('Bootstrap');
  logger.log('Connected to database');

  await app.listen(process.env.PORT ?? 3000);
}

await bootstrap();
