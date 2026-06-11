import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter.js';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import path from 'node:path';
import { AdminSettingsModule } from './admin-settings/admin-settings.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ContentModule } from './content/content.module.js';
import { HashtagModule } from './hashtag/hashtag.module.js';
import { HealthModule } from './health/health.module.js';
import { SrsModule } from './srs/srs.module.js';
import { UserPreferencesModule } from './user-preferences/user-preferences.module.js';
import { UsersModule } from './users/users.module.js';
import { EnvDto, validateEnv } from './util/env.dto.js';
import { VocabularyModule } from './vocabulary/vocabulary.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    AdminSettingsModule,
    AuthModule,
    VocabularyModule,
    SrsModule,
    UsersModule,
    UserPreferencesModule,
    ContentModule,
    HashtagModule,
    HealthModule,
    ServeStaticModule.forRoot({
      rootPath: path.join(import.meta.dirname, '..', 'public/assets'),
      serveRoot: '/assets',
    }),
    ServeStaticModule.forRoot({
      rootPath: path.join(
        import.meta.dirname,
        '../../..',
        'apps/docs/docs/.vitepress/dist',
      ),
      serveRoot: '/guide',
      // VitePress emits .html files; resolve extensionless URLs like
      // /guide/overview to overview.html.
      serveStaticOptions: { extensions: ['html'] },
    }),
    ServeStaticModule.forRoot({
      rootPath: path.join(
        import.meta.dirname,
        '../../..',
        'apps/web/www/browser',
      ),
    }),
    MailerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvDto, true>) => ({
        transport: {
          host: config.get('SMTP_HOST'),
          port: parseInt(config.get('SMTP_PORT'), 10),
          auth: {
            type: 'login',
            user: config.get('SMTP_USER'),
            pass: config.get('SMTP_PASSWORD'),
          },
        },
        defaults: {
          from: `"${config.get('SITE_NAME')}" <${config.get('SMTP_USER')}>`,
        },
        template: {
          dir: path.join(import.meta.dirname, '..', 'templates'),
          adapter: new HandlebarsAdapter(),
          options: {
            strict: true,
          },
        },
      }),
    }),
  ],
})
export class AppModule {}
