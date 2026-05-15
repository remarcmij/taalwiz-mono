import { Module } from '@nestjs/common';
import { BookmarksController } from './bookmarks.controller.js';
import { BookmarksService } from './bookmarks.service.js';

@Module({
  providers: [BookmarksService],
  controllers: [BookmarksController],
})
export class BookmarksModule {}
