import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtPayload } from '../auth/types/jwtpayload.interface.js';
import { BookmarkListInfo, BookmarksService } from './bookmarks.service.js';
import { CreateBookmarkDto } from './dto/create-bookmark.dto.js';
import { CreateBookmarkListDto } from './dto/create-bookmark-list.dto.js';
import { RenameBookmarkListDto } from './dto/rename-bookmark-list.dto.js';

@Controller('bookmarks')
export class BookmarksController {
  constructor(private readonly bookmarksService: BookmarksService) {}

  // --- List management routes (must come before the bare GET/POST/DELETE) ---

  @Get('lists')
  async getLists(@Req() req: Request): Promise<BookmarkListInfo[]> {
    const userId = (req['user'] as JwtPayload).sub;
    return this.bookmarksService.findAllLists(userId);
  }

  @Post('lists')
  async createList(@Req() req: Request, @Body() dto: CreateBookmarkListDto): Promise<BookmarkListInfo> {
    const userId = (req['user'] as JwtPayload).sub;
    return this.bookmarksService.createList(userId, dto.name);
  }

  @Delete('lists/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteList(@Req() req: Request, @Param('id') id: string): Promise<void> {
    const userId = (req['user'] as JwtPayload).sub;
    await this.bookmarksService.deleteList(userId, id);
  }

  @Patch('lists/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async renameList(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: RenameBookmarkListDto,
  ): Promise<void> {
    const userId = (req['user'] as JwtPayload).sub;
    await this.bookmarksService.renameList(userId, id, dto.name);
  }

  // --- Bookmark CRUD routes ---

  @Get()
  async list(@Req() req: Request, @Query('listId') listId: string) {
    const userId = (req['user'] as JwtPayload).sub;
    return this.bookmarksService.findAll(userId, listId);
  }

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  async add(@Req() req: Request, @Body() dto: CreateBookmarkDto) {
    const userId = (req['user'] as JwtPayload).sub;
    await this.bookmarksService.add(userId, dto.word, dto.lang, dto.listId);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Req() req: Request,
    @Query('word') word: string,
    @Query('lang') lang: string,
    @Query('listId') listId: string,
  ) {
    const userId = (req['user'] as JwtPayload).sub;
    await this.bookmarksService.remove(userId, word, lang, listId);
  }
}
