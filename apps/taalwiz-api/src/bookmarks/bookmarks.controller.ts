import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtPayload } from '../auth/types/jwtpayload.interface.js';
import { BookmarksService } from './bookmarks.service.js';
import { CreateBookmarkDto } from './dto/create-bookmark.dto.js';

@Controller('bookmarks')
export class BookmarksController {
  constructor(private readonly bookmarksService: BookmarksService) {}

  @Get()
  async list(
    @Req() req: Request,
    @Query('list') list = 'default',
  ) {
    const userId = (req['user'] as JwtPayload).sub;
    return this.bookmarksService.findAll(userId, list);
  }

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  async add(@Req() req: Request, @Body() dto: CreateBookmarkDto) {
    const userId = (req['user'] as JwtPayload).sub;
    await this.bookmarksService.add(userId, dto.word, dto.lang, dto.list ?? 'default');
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Req() req: Request,
    @Query('word') word: string,
    @Query('lang') lang: string,
    @Query('list') list = 'default',
  ) {
    const userId = (req['user'] as JwtPayload).sub;
    await this.bookmarksService.remove(userId, word, lang, list);
  }
}
