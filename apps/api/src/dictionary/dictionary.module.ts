import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ContentService } from '../content/content.service.js';
import { DictionaryController } from './dictionary.controller.js';
import { DictionaryService } from './dictionary.service.js';

@Module({
  imports: [CacheModule.register({ ttl: 1000 * 60 * 60 })],
  controllers: [DictionaryController],
  providers: [DictionaryService, ContentService],
})
export class DictionaryModule {}
