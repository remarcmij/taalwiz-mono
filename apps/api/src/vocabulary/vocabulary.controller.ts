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
import {
  PublicVocabularyListInfo,
  VocabularyListInfo,
  VocabularyService,
} from './vocabulary.service.js';
import { BulkAddVocabularyDto } from './dto/create-vocabulary-item.dto.js';
import { CreateVocabularyListDto } from './dto/create-vocabulary-list.dto.js';
import { UpdateVocabularyListDto } from './dto/update-vocabulary-list.dto.js';

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
  async updateList(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateVocabularyListDto,
  ): Promise<void> {
    await this.vocabularyService.updateList(user.sub, id, dto);
  }

  // --- Public (shared) list routes ---

  @Get('public')
  async getPublicLists(@CurrentUser() user: JwtPayload): Promise<PublicVocabularyListInfo[]> {
    return this.vocabularyService.findPublicLists(user.sub);
  }

  @Get('public/:id/items')
  async getPublicItems(@Param('id') id: string) {
    return this.vocabularyService.findPublicItems(id);
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

  // Deliberate bulk import — into a new or existing deck. Unlike the single add
  // above, this is allowed even when the target list is locked.
  @Post('import')
  @HttpCode(HttpStatus.NO_CONTENT)
  async import(@CurrentUser() user: JwtPayload, @Body() dto: BulkAddVocabularyDto) {
    await this.vocabularyService.importMany(user.sub, dto.items);
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
