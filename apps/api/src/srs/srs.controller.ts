import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { JwtPayload } from '../auth/types/jwtpayload.interface.js';
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
}
