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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
        host: process.env.SMTP_HOST!,
        port: parseInt(process.env.SMTP_PORT!, 10),
        auth: {
          type: 'login',
          user: process.env.SMTP_USER!,
          pass: process.env.SMTP_PASSWORD!,
        },
      },
      defaults: {
        from: '"TaalWiz" <taalwiz@kpnmail.nl>',
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
