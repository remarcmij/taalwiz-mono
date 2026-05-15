import { Module } from '@nestjs/common';
import { SrsModule } from '../srs/srs.module.js';
import { BookmarksController } from './bookmarks.controller.js';
import { BookmarksService } from './bookmarks.service.js';

@Module({
  imports: [SrsModule],
  providers: [BookmarksService],
  controllers: [BookmarksController],
})
export class BookmarksModule {}
