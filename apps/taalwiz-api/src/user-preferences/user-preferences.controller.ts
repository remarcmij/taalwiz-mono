import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Req } from '@nestjs/common';
import type { Request } from 'express';
import { JwtPayload } from '../auth/types/jwtpayload.interface.js';
import { UpdateUserPreferencesDto } from './dto/update-user-preferences.dto.js';
import { UserPreferencesData, UserPreferencesService } from './user-preferences.service.js';

@Controller('user-preferences')
export class UserPreferencesController {
  constructor(private readonly userPreferencesService: UserPreferencesService) {}

  @Get()
  async get(@Req() req: Request): Promise<UserPreferencesData> {
    const userId = (req['user'] as JwtPayload).sub;
    return this.userPreferencesService.get(userId);
  }

  @Patch()
  @HttpCode(HttpStatus.NO_CONTENT)
  async patch(@Req() req: Request, @Body() dto: UpdateUserPreferencesDto): Promise<void> {
    const userId = (req['user'] as JwtPayload).sub;
    await this.userPreferencesService.patch(userId, dto.currentBookmarkListId);
  }
}
