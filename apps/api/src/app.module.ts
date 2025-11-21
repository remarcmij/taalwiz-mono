import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import path from 'path';
import { fileURLToPath } from 'url';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { ContentModule } from './content/content.module.js';
import { DictionaryModule } from './dictionary/dictionary.module.js';
import { UsersModule } from './users/users.module.js';
import { HashtagModule } from './hashtag/hashtag.module.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
@Module({
  imports: [
    DictionaryModule,
    AuthModule,
    UsersModule,
    ContentModule,
    ServeStaticModule.forRoot({
      rootPath: path.join(__dirname, '..', 'public'),
    }),
    HashtagModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
