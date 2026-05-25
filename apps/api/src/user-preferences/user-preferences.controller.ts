import { Body, Controller, Get, HttpCode, HttpStatus, Patch } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { JwtPayload } from '../auth/types/jwtpayload.interface.js';
import { UpdateUserPreferencesDto } from './dto/update-user-preferences.dto.js';
import { UserPreferencesData, UserPreferencesService } from './user-preferences.service.js';

@Controller('user-preferences')
export class UserPreferencesController {
  constructor(private readonly userPreferencesService: UserPreferencesService) {}

  @Get()
  async get(@CurrentUser() user: JwtPayload): Promise<UserPreferencesData> {
    return this.userPreferencesService.get(user.sub);
  }

  @Patch()
  @HttpCode(HttpStatus.NO_CONTENT)
  async patch(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateUserPreferencesDto,
  ): Promise<void> {
    await this.userPreferencesService.patch(user.sub, dto.currentVocabularyListId);
  }
}
