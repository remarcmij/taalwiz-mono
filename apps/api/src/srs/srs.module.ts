import { Module } from '@nestjs/common';
import { SrsController } from './srs.controller.js';
import { SrsService } from './srs.service.js';

@Module({
  providers: [SrsService],
  controllers: [SrsController],
  exports: [SrsService],
})
export class SrsModule {}
