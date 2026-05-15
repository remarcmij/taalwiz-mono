import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import SrsCard from './models/srs-card.model.js';

export interface SrsCardInfo {
  word: string;
  lang: string;
  listId: string;
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
  async createCard(userId: string, word: string, lang: string, listId: string): Promise<void> {
    await SrsCard.findOneAndUpdate(
      { userId: new Types.ObjectId(userId), listId: new Types.ObjectId(listId), word, lang },
      { $setOnInsert: { interval: 1, easeFactor: 2.5, dueDate: new Date(), reps: 0, lapses: 0 } },
      { upsert: true, new: true },
    ).exec();
  }

  async deleteCard(userId: string, word: string, lang: string, listId: string): Promise<void> {
    await SrsCard.deleteOne({
      userId: new Types.ObjectId(userId),
      listId: new Types.ObjectId(listId),
      word,
      lang,
    }).exec();
  }

  async deleteCardsByList(userId: string, listId: string): Promise<void> {
    await SrsCard.deleteMany({
      userId: new Types.ObjectId(userId),
      listId: new Types.ObjectId(listId),
    }).exec();
  }

  async getDueCards(userId: string, listId: string): Promise<SrsCardInfo[]> {
    const cards = await SrsCard.find({
      userId: new Types.ObjectId(userId),
      listId: new Types.ObjectId(listId),
      dueDate: { $lte: new Date() },
    }).exec();
    return cards.map(toSrsCardInfo);
  }

  async getAllStats(userId: string): Promise<SrsStatsEntry[]> {
    const now = new Date();
    const agg = await SrsCard.aggregate<{ _id: Types.ObjectId; due: number; new: number; total: number }>([
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
    word: string,
    lang: string,
    listId: string,
    rating: 'again' | 'good' | 'easy',
  ): Promise<{ dueDate: Date }> {
    const card = await SrsCard.findOne({
      userId: new Types.ObjectId(userId),
      listId: new Types.ObjectId(listId),
      word,
      lang,
    }).exec();

    if (!card) {
      await this.createCard(userId, word, lang, listId);
      return { dueDate: new Date() };
    }

    const next = applySm2({ interval: card.interval, easeFactor: card.easeFactor, reps: card.reps, lapses: card.lapses }, rating);
    const newDueDate = rating === 'again' ? new Date() : addDays(new Date(), next.interval);

    await SrsCard.updateOne(
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

function toSrsCardInfo(card: { word: string; lang: string; listId: unknown; interval: number; easeFactor: number; dueDate: unknown; reps: number; lapses: number }): SrsCardInfo {
  return {
    word: card.word,
    lang: card.lang,
    listId: String(card.listId),
    interval: card.interval,
    easeFactor: card.easeFactor,
    dueDate: (card.dueDate as Date).toISOString(),
    reps: card.reps,
    lapses: card.lapses,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
