import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter.js';
import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import path from 'node:path';
import { AuthModule } from './auth/auth.module.js';
import { BookmarksModule } from './bookmarks/bookmarks.module.js';
import { ContentModule } from './content/content.module.js';
import { HashtagModule } from './hashtag/hashtag.module.js';
import { UsersModule } from './users/users.module.js';
import { UserPreferencesModule } from './user-preferences/user-preferences.module.js';
import { SrsModule } from './srs/srs.module.js';
import { EnvDto } from './util/env.dto.js';

const env = EnvDto.getInstance();

@Module({
  imports: [
    AuthModule,
    BookmarksModule,
    SrsModule,
    UsersModule,
    UserPreferencesModule,
    ContentModule,
    HashtagModule,
    ServeStaticModule.forRoot({
      rootPath: path.join(import.meta.dirname, '../..', 'public/assets'),
      serveRoot: '/assets',
    }),
    ServeStaticModule.forRoot({
      rootPath: path.join(
        import.meta.dirname,
        '../../..',
        'taalwiz-web/www/browser',
      ),
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
        dir: path.join(import.meta.dirname, '..', 'templates'),
        adapter: new HandlebarsAdapter(),
        options: {
          strict: true,
        },
      },
    }),
  ],
})
export class AppModule {}
