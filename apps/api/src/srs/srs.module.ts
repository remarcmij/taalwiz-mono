import { Module } from '@nestjs/common';
import { UserPreferencesModule } from '../user-preferences/user-preferences.module.js';
import { SrsController } from './srs.controller.js';
import { SrsService } from './srs.service.js';

@Module({
  imports: [UserPreferencesModule],
  providers: [SrsService],
  controllers: [SrsController],
  exports: [SrsService],
})
export class SrsModule {}
