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
import { VocabularyListInfo, VocabularyService } from './vocabulary.service.js';
import { CreateVocabularyItemDto } from './dto/create-vocabulary-item.dto.js';
import { CreateVocabularyListDto } from './dto/create-vocabulary-list.dto.js';
import { RenameVocabularyListDto } from './dto/rename-vocabulary-list.dto.js';

@Controller('vocabulary')
export class VocabularyController {
  constructor(private readonly vocabularyService: VocabularyService) {}

  // --- List management routes (must come before the bare GET/POST/DELETE) ---

  @Get('lists')
  async getLists(@Req() req: Request): Promise<VocabularyListInfo[]> {
    const userId = (req['user'] as JwtPayload).sub;
    return this.vocabularyService.findAllLists(userId);
  }

  @Post('lists')
  async createList(@Req() req: Request, @Body() dto: CreateVocabularyListDto): Promise<VocabularyListInfo> {
    const userId = (req['user'] as JwtPayload).sub;
    return this.vocabularyService.createList(userId, dto.name);
  }

  @Delete('lists/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteList(@Req() req: Request, @Param('id') id: string): Promise<void> {
    const userId = (req['user'] as JwtPayload).sub;
    await this.vocabularyService.deleteList(userId, id);
  }

  @Patch('lists/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async renameList(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: RenameVocabularyListDto,
  ): Promise<void> {
    const userId = (req['user'] as JwtPayload).sub;
    await this.vocabularyService.renameList(userId, id, dto.name);
  }

  // --- Vocabulary item CRUD routes ---

  @Get()
  async list(@Req() req: Request, @Query('listId') listId: string) {
    const userId = (req['user'] as JwtPayload).sub;
    return this.vocabularyService.findAll(userId, listId);
  }

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  async add(@Req() req: Request, @Body() dto: CreateVocabularyItemDto) {
    const userId = (req['user'] as JwtPayload).sub;
    await this.vocabularyService.add(userId, dto.term, dto.lang, dto.listId, dto.back);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Req() req: Request,
    @Query('term') term: string,
    @Query('lang') lang: string,
    @Query('listId') listId: string,
  ) {
    const userId = (req['user'] as JwtPayload).sub;
    await this.vocabularyService.remove(userId, term, lang, listId);
  }
}
