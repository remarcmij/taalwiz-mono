import { Controller, Get, Param } from '@nestjs/common';
import { HashtagService } from './hashtag.service.js';

@Controller('hashtags')
export class HashtagController {
  constructor(private readonly hashtagService: HashtagService) {}

  @Get()
  async getHashtagIndex() {
    return await this.hashtagService.getHashtagIndex();
  }

  @Get(':name')
  async findHashtag(@Param('name') name: string) {
    return await this.hashtagService.findHashtag(name);
  }
}
