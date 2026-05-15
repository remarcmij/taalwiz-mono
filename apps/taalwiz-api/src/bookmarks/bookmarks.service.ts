import { Injectable } from '@nestjs/common';
import Bookmark, { BookmarkDoc } from './models/bookmark.model.js';

@Injectable()
export class BookmarksService {
  async findAll(userId: string, listName = 'default'): Promise<BookmarkDoc[]> {
    return Bookmark.find({ userId, listName }).sort({ savedAt: -1 }).exec();
  }

  async add(
    userId: string,
    word: string,
    lang: string,
    listName = 'default',
  ): Promise<void> {
    await Bookmark.findOneAndUpdate(
      { userId, listName, word, lang },
      { $setOnInsert: { savedAt: new Date() } },
      { upsert: true, new: true },
    ).exec();
  }

  async remove(
    userId: string,
    word: string,
    lang: string,
    listName = 'default',
  ): Promise<void> {
    await Bookmark.deleteOne({ userId, listName, word, lang }).exec();
  }
}
