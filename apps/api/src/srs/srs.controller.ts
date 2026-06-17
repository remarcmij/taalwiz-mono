import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { JwtPayload } from '../auth/types/jwtpayload.interface.js';
import { SrsLemmaIndexDto } from './dto/srs-lemma-index.dto.js';
import { SrsReviewDto } from './dto/srs-review.dto.js';
import { SrsItemInfo, SrsService, SrsStatsEntry } from './srs.service.js';

@Controller('srs')
export class SrsController {
  constructor(private readonly srsService: SrsService) {}

  @Get('due')
  async getDueCards(
    @CurrentUser() user: JwtPayload,
    @Query('listId') listId: string,
    @Query('all') all?: string,
  ): Promise<SrsItemInfo[]> {
    return this.srsService.getDueCards(user.sub, listId, all === 'true');
  }

  @Get('stats')
  async getStats(@CurrentUser() user: JwtPayload): Promise<SrsStatsEntry[]> {
    return this.srsService.getAllStats(user.sub);
  }

  @Post('review')
  @HttpCode(HttpStatus.OK)
  async reviewCard(
    @CurrentUser() user: JwtPayload,
    @Body() dto: SrsReviewDto,
  ): Promise<{ dueDate: string }> {
    const result = await this.srsService.reviewCard(user.sub, dto.term, dto.lang, dto.listId, dto.rating);
    return { dueDate: result.dueDate.toISOString() };
  }

  // Which dictionary line a back-less card shows. Personal study state — deliberately
  // NOT gated by the list lock, unlike vocabulary content edits.
  @Get('lemma-index')
  async getLemmaIndex(
    @CurrentUser() user: JwtPayload,
    @Query('listId') listId: string,
    @Query('term') term: string,
    @Query('lang') lang: string,
  ): Promise<{ lemmaIndex: number }> {
    const lemmaIndex = await this.srsService.getLemmaIndex(user.sub, term, lang, listId);
    return { lemmaIndex };
  }

  @Post('lemma-index')
  @HttpCode(HttpStatus.OK)
  async setLemmaIndex(@CurrentUser() user: JwtPayload, @Body() dto: SrsLemmaIndexDto): Promise<void> {
    await this.srsService.setLemmaIndex(user.sub, dto.term, dto.lang, dto.listId, dto.lemmaIndex);
  }
}
