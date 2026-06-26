import 'dotenv/config';

import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import mongoose from 'mongoose';
import morgan from 'morgan';
import { AppModule } from './app.module.js';
import type { EnvDto } from './util/env.dto.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService<EnvDto, true>);

  // Raise the JSON body limit from Express's 100 KB default so bulk vocabulary
  // imports (large SRS decks pasted as one request) aren't rejected with 413.
  // The production nginx already allows 10M; keep the app comfortably under that.
  app.useBodyParser('json', { limit: '1mb' });

  app.enableCors();

  if (config.get('NODE_ENV') === 'development') {
    app.use(morgan('dev'));
  }

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      enableDebugMessages: true,
    }),
  );

  await mongoose.connect(config.get('MONGO_URL'), {
    // Defaults to 'taalwiz'; a second instance (e.g. the en/Stevens deployment)
    // sets MONGO_DB to an isolated database on the same MongoDB server.
    dbName: config.get('MONGO_DB') ?? 'taalwiz',
  });

  const logger = new Logger('Bootstrap');
  logger.log('Connected to database');

  await app.listen(process.env.PORT ?? 3000);
}

await bootstrap();
