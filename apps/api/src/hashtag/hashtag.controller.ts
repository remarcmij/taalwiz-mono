import { Controller, Get, Param } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { JwtPayload } from '../auth/types/jwtpayload.interface.js';
import { HashtagService } from './hashtag.service.js';

@Controller('hashtags')
export class HashtagController {
  constructor(private readonly hashtagService: HashtagService) {}

  @Get()
  async getHashtagIndex(@CurrentUser() user: JwtPayload) {
    return await this.hashtagService.getHashtagIndex(user);
  }

  // Declared before ':name' so it is not captured as a tag-name lookup.
  @Roles('admin')
  @Get('usage')
  async getHashtagUsage() {
    return await this.hashtagService.getHashtagUsage();
  }

  @Get(':name')
  async findHashtag(@Param('name') name: string, @CurrentUser() user: JwtPayload) {
    return await this.hashtagService.findHashtag(name, user);
  }
}
