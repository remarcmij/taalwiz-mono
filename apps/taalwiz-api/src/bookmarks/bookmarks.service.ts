import { ConflictException, Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import Bookmark, { BookmarkDoc } from './models/bookmark.model.js';
import BookmarkList from './models/bookmark-list.model.js';

export interface BookmarkListInfo {
  id: string;
  name: string;
  count: number;
}

@Injectable()
export class BookmarksService {
  async findAllLists(userId: string): Promise<BookmarkListInfo[]> {
    const userObjectId = new Types.ObjectId(userId);
    let lists = await BookmarkList.find({ userId: userObjectId }).sort({ createdAt: 1 }).exec();

    if (lists.length === 0) {
      const created = await BookmarkList.create({ userId: userObjectId, name: 'Favorites' });
      lists = [created];
    }

    const counts = await Bookmark.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { userId: userObjectId } },
      { $group: { _id: '$listId', count: { $sum: 1 } } },
    ]).exec();

    const countMap = new Map(counts.map((c) => [c._id.toString(), c.count]));
    return lists.map((l) => ({ id: l._id.toString(), name: l.name, count: countMap.get(l._id.toString()) ?? 0 }));
  }

  async createList(userId: string, name: string): Promise<BookmarkListInfo> {
    try {
      const list = await BookmarkList.create({ userId: new Types.ObjectId(userId), name });
      return { id: list._id.toString(), name: list.name, count: 0 };
    } catch (err: unknown) {
      if ((err as { code?: number }).code === 11000) {
        throw new ConflictException(`List '${name}' already exists`);
      }
      throw err;
    }
  }

  async deleteList(userId: string, listId: string): Promise<void> {
    const listObjectId = new Types.ObjectId(listId);
    const userObjectId = new Types.ObjectId(userId);
    await BookmarkList.deleteOne({ _id: listObjectId, userId: userObjectId }).exec();
    await Bookmark.deleteMany({ userId: userObjectId, listId: listObjectId }).exec();
  }

  async renameList(userId: string, listId: string, newName: string): Promise<void> {
    try {
      await BookmarkList.findOneAndUpdate(
        { _id: new Types.ObjectId(listId), userId: new Types.ObjectId(userId) },
        { $set: { name: newName } },
      ).exec();
    } catch (err: unknown) {
      if ((err as { code?: number }).code === 11000) {
        throw new ConflictException(`List '${newName}' already exists`);
      }
      throw err;
    }
  }

  async findAll(userId: string, listId: string): Promise<BookmarkDoc[]> {
    return Bookmark.find({ userId: new Types.ObjectId(userId), listId: new Types.ObjectId(listId) })
      .sort({ savedAt: -1 })
      .exec();
  }

  async add(userId: string, word: string, lang: string, listId: string): Promise<void> {
    const userObjectId = new Types.ObjectId(userId);
    const listObjectId = new Types.ObjectId(listId);
    await Bookmark.findOneAndUpdate(
      { userId: userObjectId, listId: listObjectId, word, lang },
      { $setOnInsert: { savedAt: new Date() } },
      { upsert: true, new: true },
    ).exec();
  }

  async remove(userId: string, word: string, lang: string, listId: string): Promise<void> {
    await Bookmark.deleteOne({
      userId: new Types.ObjectId(userId),
      listId: new Types.ObjectId(listId),
      word,
      lang,
    }).exec();
  }
}
