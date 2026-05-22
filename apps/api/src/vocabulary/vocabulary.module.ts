import { Module } from '@nestjs/common';
import { SrsModule } from '../srs/srs.module.js';
import { VocabularyController } from './vocabulary.controller.js';
import { VocabularyService } from './vocabulary.service.js';

@Module({
  imports: [SrsModule],
  providers: [VocabularyService],
  controllers: [VocabularyController],
})
export class VocabularyModule {}
