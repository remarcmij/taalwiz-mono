import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AnyBulkWriteOperation, Types } from 'mongoose';
import { SrsService } from '../srs/srs.service.js';
import User from '../users/models/user.model.js';
import { CreateVocabularyItemDto } from './dto/create-vocabulary-item.dto.js';
import VocabularyItem, { VocabularyItemDoc } from './models/vocabulary-item.model.js';
import VocabularyList from './models/vocabulary-list.model.js';

export interface VocabularyListInfo {
  id: string;
  name: string;
  count: number;
  isPublic: boolean;
  isLocked: boolean;
}

export interface PublicVocabularyListInfo {
  id: string;
  name: string;
  ownerName: string;
  count: number;
}

// Natural, case-insensitive ordering so "Ham les 2" sorts before "Ham les 11".
const nameCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

// "Favorites" is the default home list and stays pinned to the top; the rest
// are sorted by name so a list is easy to find in the dropdown.
function byPinnedThenName(a: VocabularyListInfo, b: VocabularyListInfo): number {
  const aFav = a.name === 'Favorites';
  const bFav = b.name === 'Favorites';
  if (aFav !== bFav) return aFav ? -1 : 1;
  return nameCollator.compare(a.name, b.name);
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
    return lists
      .map((l) => ({
        id: l._id.toString(),
        name: l.name,
        count: countMap.get(l._id.toString()) ?? 0,
        isPublic: l.isPublic ?? false,
        isLocked: l.isLocked ?? false,
      }))
      .sort(byPinnedThenName);
  }

  async createList(userId: string, name: string): Promise<VocabularyListInfo> {
    try {
      const list = await VocabularyList.create({ userId: new Types.ObjectId(userId), name });
      return { id: list._id.toString(), name: list.name, count: 0, isPublic: false, isLocked: false };
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

  async updateList(
    userId: string,
    listId: string,
    changes: { name?: string; isPublic?: boolean; isLocked?: boolean },
  ): Promise<void> {
    const set: Record<string, unknown> = {};
    if (changes.name !== undefined) set['name'] = changes.name;
    if (changes.isPublic !== undefined) set['isPublic'] = changes.isPublic;
    if (changes.isLocked !== undefined) set['isLocked'] = changes.isLocked;
    if (Object.keys(set).length === 0) return;
    try {
      await VocabularyList.findOneAndUpdate(
        { _id: new Types.ObjectId(listId), userId: new Types.ObjectId(userId) },
        { $set: set },
      ).exec();
    } catch (err: unknown) {
      if ((err as { code?: number }).code === 11000) {
        throw new ConflictException(`List '${changes.name}' already exists`);
      }
      throw err;
    }
  }

  /** Public lists owned by other users, with owner name and item count, for the browse view. */
  async findPublicLists(callerUserId: string): Promise<PublicVocabularyListInfo[]> {
    const callerObjectId = new Types.ObjectId(callerUserId);
    const lists = await VocabularyList.find({ isPublic: true, userId: { $ne: callerObjectId } })
      .sort({ createdAt: -1 })
      .exec();
    if (lists.length === 0) return [];

    const listIds = lists.map((l) => l._id);
    const ownerIds = lists.map((l) => l.userId);

    const counts = await VocabularyItem.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { listId: { $in: listIds } } },
      { $group: { _id: '$listId', count: { $sum: 1 } } },
    ]).exec();
    const countMap = new Map(counts.map((c) => [c._id.toString(), c.count]));

    const owners = await User.find({ _id: { $in: ownerIds } })
      .select('name')
      .lean()
      .exec();
    const ownerMap = new Map(owners.map((o) => [o._id.toString(), o.name as string]));

    return lists
      .map((l) => ({
        id: l._id.toString(),
        name: l.name,
        ownerName: ownerMap.get(l.userId.toString()) ?? '',
        count: countMap.get(l._id.toString()) ?? 0,
      }))
      .filter((l) => l.count > 0);
  }

  /** Items of a public list, addressed by list id only (no ownership check) — read-only browse. */
  async findPublicItems(listId: string): Promise<VocabularyItemDoc[]> {
    const listObjectId = new Types.ObjectId(listId);
    const list = await VocabularyList.findOne({ _id: listObjectId, isPublic: true }).exec();
    if (!list) throw new NotFoundException('Public list not found');
    return VocabularyItem.find({ listId: listObjectId }).sort({ savedAt: -1 }).exec();
  }

  async findAll(userId: string, listId: string): Promise<VocabularyItemDoc[]> {
    return VocabularyItem.find({ userId: new Types.ObjectId(userId), listId: new Types.ObjectId(listId) })
      .sort({ savedAt: -1 })
      .exec();
  }

  /**
   * Reject an interactive per-word change that targets a locked list (a single
   * bookmark add or removal). Deliberate bulk import does not call this — it goes
   * through `importMany`, which is allowed on a locked list. SRS review state is
   * never affected by the lock.
   */
  async #assertNotLocked(userId: string, listIds: string[]): Promise<void> {
    const ids = [...new Set(listIds)].map((id) => new Types.ObjectId(id));
    const locked = await VocabularyList.findOne({
      _id: { $in: ids },
      userId: new Types.ObjectId(userId),
      isLocked: true,
    }).exec();
    if (locked) {
      throw new ConflictException(`List '${locked.name}' is locked`);
    }
  }

  /**
   * Interactive single-word add (bookmark a word, restore an undone removal).
   * Rejected on a locked list, since locking exists to stop exactly this kind of
   * incidental per-word change.
   */
  async addMany(userId: string, items: CreateVocabularyItemDto[]): Promise<void> {
    if (items.length === 0) return;
    await this.#assertNotLocked(userId, items.map((i) => i.listId));
    await this.#upsertItems(userId, items);
  }

  /**
   * Deliberate bulk import (pasted text, or pulling in a public list). This is
   * how a list grows, so it is allowed even on a locked list — locking only
   * guards incidental per-word edits, never an explicit import.
   */
  async importMany(userId: string, items: CreateVocabularyItemDto[]): Promise<void> {
    if (items.length === 0) return;
    await this.#upsertItems(userId, items);
  }

  async #upsertItems(userId: string, items: CreateVocabularyItemDto[]): Promise<void> {
    const userObjectId = new Types.ObjectId(userId);
    // Stamp the batch with strictly decreasing savedAt values (base − index) so
    // the first item is the newest. The list view sorts savedAt descending, so
    // this makes a bulk import read top-to-bottom in the order it was pasted,
    // as one block at the top of the list. Without distinct timestamps every
    // item shares a single millisecond and the sort tie-breaks unpredictably.
    const base = Date.now();
    const ops: AnyBulkWriteOperation<VocabularyItemDoc>[] = items.map(
      ({ term, lang, listId, back }, index) => {
        const setOnInsert: Record<string, unknown> = { savedAt: new Date(base - index) };
        const update: Record<string, unknown> = { $setOnInsert: setOnInsert };
        if (back !== undefined) update['$set'] = { back };
        return {
          updateOne: {
            filter: { userId: userObjectId, listId: new Types.ObjectId(listId), term, lang },
            update,
            upsert: true,
          },
        };
      },
    );
    await VocabularyItem.bulkWrite(ops);
    await this.srsService.createCards(userId, items);
  }

  async remove(userId: string, term: string, lang: string, listId: string): Promise<void> {
    await this.#assertNotLocked(userId, [listId]);
    await VocabularyItem.deleteOne({
      userId: new Types.ObjectId(userId),
      listId: new Types.ObjectId(listId),
      term,
      lang,
    }).exec();
    await this.srsService.deleteCard(userId, term, lang, listId);
  }
}
