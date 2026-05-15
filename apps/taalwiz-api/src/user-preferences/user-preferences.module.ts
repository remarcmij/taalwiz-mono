import { Module } from '@nestjs/common';
import { UserPreferencesController } from './user-preferences.controller.js';
import { UserPreferencesService } from './user-preferences.service.js';

@Module({
  providers: [UserPreferencesService],
  controllers: [UserPreferencesController],
})
export class UserPreferencesModule {}
