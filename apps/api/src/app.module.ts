import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter.js';
import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import path from 'node:path';
import { fileURLToPath } from 'url';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { ContentModule } from './content/content.module.js';
import { DictionaryModule } from './dictionary/dictionary.module.js';
import { HashtagModule } from './hashtag/hashtag.module.js';
import { UsersModule } from './users/users.module.js';
import { EnvDto } from './util/env.dto.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const env = EnvDto.getInstance();

console.log(path.join(__dirname, '../../web/www/browser'));
@Module({
  imports: [
    DictionaryModule,
    AuthModule,
    UsersModule,
    ContentModule,
    HashtagModule,
    ServeStaticModule.forRoot({
      rootPath: path.join(__dirname, '..', 'public'),
    }),
    ServeStaticModule.forRoot({
      rootPath: path.join(__dirname, '../../web/www/browser'),
    }),
    MailerModule.forRoot({
      transport: {
        host: env.smtpHost,
        port: parseInt(env.smtpPort!, 10),
        auth: {
          type: 'login',
          user: env.smtpUser,
          pass: env.smtpPassword,
        },
      },
      defaults: {
        from: `"${env.siteName}" <${env.smtpUser}>`,
      },
      template: {
        dir: path.join(__dirname, '..', 'templates'),
        adapter: new HandlebarsAdapter(),
        options: {
          strict: true,
        },
      },
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
