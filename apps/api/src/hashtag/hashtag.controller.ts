import { Controller, Get, Param, Req } from '@nestjs/common';
import type { Request } from 'express';
import type { JwtPayload } from '../auth/types/jwtpayload.interface.js';
import { HashtagService } from './hashtag.service.js';

@Controller('hashtags')
export class HashtagController {
  constructor(private readonly hashtagService: HashtagService) {}

  @Get()
  async getHashtagIndex(@Req() req: Request) {
    return await this.hashtagService.getHashtagIndex(req['user'] as JwtPayload);
  }

  @Get(':name')
  async findHashtag(@Param('name') name: string, @Req() req: Request) {
    return await this.hashtagService.findHashtag(name, req['user'] as JwtPayload);
  }
}
