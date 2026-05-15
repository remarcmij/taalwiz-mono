import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { JwtPayload } from '../auth/types/jwtpayload.interface.js';
import { ReviewSrsCardDto } from './dto/review-srs-card.dto.js';
import { SrsCardInfo, SrsService, SrsStatsEntry } from './srs.service.js';

@Controller('srs')
export class SrsController {
  constructor(private readonly srsService: SrsService) {}

  @Get('due')
  async getDueCards(@Req() req: Request, @Query('listId') listId: string): Promise<SrsCardInfo[]> {
    const userId = (req['user'] as JwtPayload).sub;
    return this.srsService.getDueCards(userId, listId);
  }

  @Get('stats')
  async getStats(@Req() req: Request): Promise<SrsStatsEntry[]> {
    const userId = (req['user'] as JwtPayload).sub;
    return this.srsService.getAllStats(userId);
  }

  @Post('review')
  @HttpCode(HttpStatus.OK)
  async reviewCard(@Req() req: Request, @Body() dto: ReviewSrsCardDto): Promise<{ dueDate: string }> {
    const userId = (req['user'] as JwtPayload).sub;
    const result = await this.srsService.reviewCard(userId, dto.word, dto.lang, dto.listId, dto.rating);
    return { dueDate: result.dueDate.toISOString() };
  }
}
