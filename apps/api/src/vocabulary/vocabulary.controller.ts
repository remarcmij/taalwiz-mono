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
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { JwtPayload } from '../auth/types/jwtpayload.interface.js';
import { VocabularyListInfo, VocabularyService } from './vocabulary.service.js';
import { BulkAddVocabularyDto } from './dto/create-vocabulary-item.dto.js';
import { CreateVocabularyListDto } from './dto/create-vocabulary-list.dto.js';
import { RenameVocabularyListDto } from './dto/rename-vocabulary-list.dto.js';

@Controller('vocabulary')
export class VocabularyController {
  constructor(private readonly vocabularyService: VocabularyService) {}

  // --- List management routes (must come before the bare GET/POST/DELETE) ---

  @Get('lists')
  async getLists(@CurrentUser() user: JwtPayload): Promise<VocabularyListInfo[]> {
    return this.vocabularyService.findAllLists(user.sub);
  }

  @Post('lists')
  async createList(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateVocabularyListDto,
  ): Promise<VocabularyListInfo> {
    return this.vocabularyService.createList(user.sub, dto.name);
  }

  @Delete('lists/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteList(@CurrentUser() user: JwtPayload, @Param('id') id: string): Promise<void> {
    await this.vocabularyService.deleteList(user.sub, id);
  }

  @Patch('lists/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async renameList(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: RenameVocabularyListDto,
  ): Promise<void> {
    await this.vocabularyService.renameList(user.sub, id, dto.name);
  }

  // --- Vocabulary item CRUD routes ---

  @Get()
  async list(@CurrentUser() user: JwtPayload, @Query('listId') listId: string) {
    return this.vocabularyService.findAll(user.sub, listId);
  }

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  async add(@CurrentUser() user: JwtPayload, @Body() dto: BulkAddVocabularyDto) {
    await this.vocabularyService.addMany(user.sub, dto.items);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: JwtPayload,
    @Query('term') term: string,
    @Query('lang') lang: string,
    @Query('listId') listId: string,
  ) {
    await this.vocabularyService.remove(user.sub, term, lang, listId);
  }
}
