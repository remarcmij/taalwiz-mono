import { ConflictException, Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { SrsService } from '../srs/srs.service.js';
import VocabularyItem, { VocabularyItemDoc } from './models/vocabulary-item.model.js';
import VocabularyList from './models/vocabulary-list.model.js';

export interface VocabularyListInfo {
  id: string;
  name: string;
  count: number;
}

@Injectable()
export class VocabularyService {
  constructor(private readonly srsService: SrsService) {}

  async findAllLists(userId: string): Promise<VocabularyListInfo[]> {
    const userObjectId = new Types.ObjectId(userId);
    let lists = await VocabularyList.find({ userId: userObjectId }).sort({ createdAt: 1 }).exec();

    if (lists.length === 0) {
      const created = await VocabularyList.create({ userId: userObjectId, name: 'Favorites' });
      lists = [created];
    }

    const counts = await VocabularyItem.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { userId: userObjectId } },
      { $group: { _id: '$listId', count: { $sum: 1 } } },
    ]).exec();

    const countMap = new Map(counts.map((c) => [c._id.toString(), c.count]));
    return lists.map((l) => ({ id: l._id.toString(), name: l.name, count: countMap.get(l._id.toString()) ?? 0 }));
  }

  async createList(userId: string, name: string): Promise<VocabularyListInfo> {
    try {
      const list = await VocabularyList.create({ userId: new Types.ObjectId(userId), name });
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
    await VocabularyList.deleteOne({ _id: listObjectId, userId: userObjectId }).exec();
    await VocabularyItem.deleteMany({ userId: userObjectId, listId: listObjectId }).exec();
    await this.srsService.deleteCardsByList(userId, listId);
  }

  async renameList(userId: string, listId: string, newName: string): Promise<void> {
    try {
      await VocabularyList.findOneAndUpdate(
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

  async findAll(userId: string, listId: string): Promise<VocabularyItemDoc[]> {
    return VocabularyItem.find({ userId: new Types.ObjectId(userId), listId: new Types.ObjectId(listId) })
      .sort({ savedAt: -1 })
      .exec();
  }

  async add(userId: string, term: string, lang: string, listId: string, back?: string): Promise<void> {
    const userObjectId = new Types.ObjectId(userId);
    const listObjectId = new Types.ObjectId(listId);
    const update: Record<string, unknown> = { $setOnInsert: { savedAt: new Date() } };
    if (back !== undefined) update['$set'] = { back };
    await VocabularyItem.findOneAndUpdate(
      { userId: userObjectId, listId: listObjectId, term, lang },
      update,
      { upsert: true, new: true },
    ).exec();
    await this.srsService.createCard(userId, term, lang, listId);
  }

  async remove(userId: string, term: string, lang: string, listId: string): Promise<void> {
    await VocabularyItem.deleteOne({
      userId: new Types.ObjectId(userId),
      listId: new Types.ObjectId(listId),
      term,
      lang,
    }).exec();
    await this.srsService.deleteCard(userId, term, lang, listId);
  }
}
