import { Module } from '@nestjs/common';
import { HashtagController } from './hashtag.controller.js';
import { HashtagService } from './hashtag.service.js';

@Module({
  controllers: [HashtagController],
  providers: [HashtagService],
})
export class HashtagModule {}
