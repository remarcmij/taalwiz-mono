import { Controller, Get, Param } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { JwtPayload } from '../auth/types/jwtpayload.interface.js';
import { HashtagService } from './hashtag.service.js';

@Controller('hashtags')
export class HashtagController {
  constructor(private readonly hashtagService: HashtagService) {}

  @Get()
  async getHashtagIndex(@CurrentUser() user: JwtPayload) {
    return await this.hashtagService.getHashtagIndex(user);
  }

  @Get(':name')
  async findHashtag(@Param('name') name: string, @CurrentUser() user: JwtPayload) {
    return await this.hashtagService.findHashtag(name, user);
  }
}
