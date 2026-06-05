import { Injectable } from '@nestjs/common';
import { AnyBulkWriteOperation, Types } from 'mongoose';
import VocabularyItem from '../vocabulary/models/vocabulary-item.model.js';
import SrsRecord, { SrsRecordDoc } from './models/srs-record.model.js';

interface SrsCardKey {
  term: string;
  lang: string;
  listId: string;
}

export interface SrsItemInfo {
  term: string;
  lang: string;
  listId: string;
  back?: string;
  sourceSentence?: string;
  interval: number;
  easeFactor: number;
  dueDate: string;
  reps: number;
  lapses: number;
}

export interface SrsStatsEntry {
  listId: string;
  due: number;
  new: number;
  total: number;
}

@Injectable()
export class SrsService {
  async createCard(userId: string, term: string, lang: string, listId: string): Promise<void> {
    await SrsRecord.findOneAndUpdate(
      { userId: new Types.ObjectId(userId), listId: new Types.ObjectId(listId), term, lang },
      { $setOnInsert: { interval: 1, easeFactor: 2.5, dueDate: new Date(), reps: 0, lapses: 0 } },
      { upsert: true, new: true },
    ).exec();
  }

  async createCards(userId: string, items: SrsCardKey[]): Promise<void> {
    if (items.length === 0) return;
    const userObjectId = new Types.ObjectId(userId);
    const ops: AnyBulkWriteOperation<SrsRecordDoc>[] = items.map(({ term, lang, listId }) => ({
      updateOne: {
        filter: { userId: userObjectId, listId: new Types.ObjectId(listId), term, lang },
        update: {
          $setOnInsert: { interval: 1, easeFactor: 2.5, dueDate: new Date(), reps: 0, lapses: 0 },
        },
        upsert: true,
      },
    }));
    await SrsRecord.bulkWrite(ops);
  }

  async deleteCard(userId: string, term: string, lang: string, listId: string): Promise<void> {
    await SrsRecord.deleteOne({
      userId: new Types.ObjectId(userId),
      listId: new Types.ObjectId(listId),
      term,
      lang,
    }).exec();
  }

  async deleteCardsByList(userId: string, listId: string): Promise<void> {
    await SrsRecord.deleteMany({
      userId: new Types.ObjectId(userId),
      listId: new Types.ObjectId(listId),
    }).exec();
  }

  async getDueCards(userId: string, listId: string, includeAll = false): Promise<SrsItemInfo[]> {
    const userObjectId = new Types.ObjectId(userId);
    const listObjectId = new Types.ObjectId(listId);

    // includeAll = on-demand "practice" session: every card in the list regardless
    // of due date. Scheduling is left untouched (no review is submitted in that mode).
    const filter: Record<string, unknown> = { userId: userObjectId, listId: listObjectId };
    if (!includeAll) filter['dueDate'] = { $lte: new Date() };

    const cards = await SrsRecord.find(filter).exec();

    if (cards.length === 0) return [];

    const terms = cards.map((c) => c.term);
    const bookmarks = await VocabularyItem.find({
      userId: userObjectId,
      listId: listObjectId,
      term: { $in: terms },
    })
      .select('term lang back sourceSentence')
      .lean()
      .exec();

    const backMap = new Map(bookmarks.map((b) => [`${b.term}:${b.lang}`, b.back as string | undefined]));
    const sourceSentenceMap = new Map(
      bookmarks.map((b) => [`${b.term}:${b.lang}`, b.sourceSentence as string | undefined]),
    );

    return cards.map((card) =>
      toSrsItemInfo(
        card,
        backMap.get(`${card.term}:${card.lang}`),
        sourceSentenceMap.get(`${card.term}:${card.lang}`),
      ),
    );
  }

  async getAllStats(userId: string): Promise<SrsStatsEntry[]> {
    const now = new Date();
    const agg = await SrsRecord.aggregate<{ _id: Types.ObjectId; due: number; new: number; total: number }>([
      { $match: { userId: new Types.ObjectId(userId) } },
      {
        $group: {
          _id: '$listId',
          due: { $sum: { $cond: [{ $lte: ['$dueDate', now] }, 1, 0] } },
          new: { $sum: { $cond: [{ $eq: ['$reps', 0] }, 1, 0] } },
          total: { $sum: 1 },
        },
      },
    ]).exec();
    return agg.map((a) => ({ listId: a._id.toString(), due: a.due, new: a.new, total: a.total }));
  }

  async reviewCard(
    userId: string,
    term: string,
    lang: string,
    listId: string,
    rating: 'again' | 'good' | 'easy',
  ): Promise<{ dueDate: Date }> {
    const card = await SrsRecord.findOne({
      userId: new Types.ObjectId(userId),
      listId: new Types.ObjectId(listId),
      term,
      lang,
    }).exec();

    if (!card) {
      await this.createCard(userId, term, lang, listId);
      return { dueDate: new Date() };
    }

    const next = applySm2({ interval: card.interval, easeFactor: card.easeFactor, reps: card.reps, lapses: card.lapses }, rating);
    const newDueDate = rating === 'again' ? new Date() : addDays(new Date(), next.interval);

    await SrsRecord.updateOne(
      { _id: card._id },
      {
        $set: {
          interval: next.interval,
          easeFactor: next.easeFactor,
          dueDate: newDueDate,
          reps: next.reps,
          lapses: next.lapses,
        },
      },
    ).exec();

    return { dueDate: newDueDate };
  }
}

export interface Sm2State {
  interval: number;
  easeFactor: number;
  reps: number;
  lapses: number;
}

export function applySm2(state: Sm2State, rating: 'again' | 'good' | 'easy'): Sm2State {
  const { interval, easeFactor, reps, lapses } = state;
  if (rating === 'again') {
    return { interval: 1, easeFactor: clamp(easeFactor - 0.2, 1.3, 4.0), reps: 0, lapses: lapses + 1 };
  }
  if (rating === 'good') {
    const newInterval = reps === 0 ? 1 : reps === 1 ? 6 : clamp(Math.round(interval * easeFactor), 1, 365);
    return { interval: newInterval, easeFactor, reps: reps + 1, lapses };
  }
  // easy
  const newInterval = reps === 0 ? 4 : reps === 1 ? 10 : clamp(Math.round(interval * easeFactor * 1.3), 1, 365);
  return { interval: newInterval, easeFactor: clamp(easeFactor + 0.15, 1.3, 4.0), reps: reps + 1, lapses };
}

function toSrsItemInfo(
  card: { term: string; lang: string; listId: unknown; interval: number; easeFactor: number; dueDate: unknown; reps: number; lapses: number },
  back: string | undefined,
  sourceSentence: string | undefined,
): SrsItemInfo {
  const info: SrsItemInfo = {
    term: card.term,
    lang: card.lang,
    listId: String(card.listId),
    interval: card.interval,
    easeFactor: card.easeFactor,
    dueDate: (card.dueDate as Date).toISOString(),
    reps: card.reps,
    lapses: card.lapses,
  };
  if (back !== undefined) info.back = back;
  if (sourceSentence !== undefined) info.sourceSentence = sourceSentence;
  return info;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
