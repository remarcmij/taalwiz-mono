import { Injectable } from '@nestjs/common';
import { AnyBulkWriteOperation, Types } from 'mongoose';
import { UserPreferencesService } from '../user-preferences/user-preferences.service.js';
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
  interval: number;
  easeFactor: number;
  dueDate: string;
  reps: number;
  lapses: number;
  /** For a back-less card: which dictionary lemma line to show (default 0). */
  lemmaIndex: number;
}

export interface SrsStatsEntry {
  listId: string;
  due: number;
  new: number;
  total: number;
  /** What a study session would actually serve right now (due reviews + the day's
   * remaining new-card allotment). This is the honest "study now" badge count. */
  available: number;
}

@Injectable()
export class SrsService {
  constructor(private readonly userPreferencesService: UserPreferencesService) {}

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

    // Fetch the whole list: the daily-cap maths needs cards that aren't due (e.g.
    // a new card introduced and graduated earlier today still counts against the
    // day's allotment), so we can't pre-filter to dueDate <= now here.
    const cards = await SrsRecord.find({ userId: userObjectId, listId: listObjectId }).exec();
    if (cards.length === 0) return [];

    // Join the vocabulary items for the `back` text and `savedAt` (the list's
    // display order, used to serve new cards first-word-first like Anki).
    const terms = cards.map((c) => c.term);
    const bookmarks = await VocabularyItem.find({
      userId: userObjectId,
      listId: listObjectId,
      term: { $in: terms },
    })
      .select('term lang back savedAt')
      .lean()
      .exec();

    const backMap = new Map(bookmarks.map((b) => [`${b.term}:${b.lang}`, b.back as string | undefined]));
    const orderMap = new Map(
      bookmarks.map((b) => [`${b.term}:${b.lang}`, (b.savedAt as Date | undefined)?.getTime() ?? 0]),
    );
    const toInfo = (card: SrsRecordDoc) => toSrsItemInfo(card, backMap.get(`${card.term}:${card.lang}`));

    // includeAll = on-demand "practice" session: every card in the list regardless
    // of due date or cap. Scheduling is left untouched (no review is submitted).
    if (includeAll) return cards.map(toInfo);

    const { newCardsPerDay } = await this.userPreferencesService.get(userId);
    const now = new Date();
    const enriched = cards.map((card) => ({
      card,
      reps: card.reps,
      dueDate: card.dueDate as Date,
      introducedAt: (card.introducedAt as Date | null) ?? null,
      order: orderMap.get(`${card.term}:${card.lang}`) ?? 0,
    }));
    return selectStudyQueue(enriched, newCardsPerDay, now).map((e) => toInfo(e.card));
  }

  async getAllStats(userId: string): Promise<SrsStatsEntry[]> {
    const now = new Date();
    const { newCardsPerDay } = await this.userPreferencesService.get(userId);
    const docs = await SrsRecord.find({ userId: new Types.ObjectId(userId) })
      .select('listId reps dueDate introducedAt')
      .lean()
      .exec();

    const byList = new Map<string, { reps: number; dueDate: Date; introducedAt: Date | null; order: number }[]>();
    for (const d of docs) {
      const key = d.listId.toString();
      const card = {
        reps: d.reps,
        dueDate: d.dueDate as Date,
        introducedAt: (d.introducedAt as Date | null) ?? null,
        order: 0,
      };
      const group = byList.get(key);
      if (group) group.push(card);
      else byList.set(key, [card]);
    }

    return [...byList.entries()].map(([listId, cards]) => ({
      listId,
      due: cards.filter((c) => c.dueDate <= now).length,
      new: cards.filter((c) => c.reps === 0).length,
      total: cards.length,
      available: selectStudyQueue(cards, newCardsPerDay, now).length,
    }));
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

    const now = new Date();
    const next = applySm2({ interval: card.interval, easeFactor: card.easeFactor, reps: card.reps, lapses: card.lapses }, rating);
    const newDueDate = rating === 'again' ? now : addDays(now, next.interval);

    const set: Record<string, unknown> = {
      interval: next.interval,
      easeFactor: next.easeFactor,
      dueDate: newDueDate,
      reps: next.reps,
      lapses: next.lapses,
    };
    // First-ever review "introduces" the card — stamp the day it counts against
    // the daily new-card cap. Subsequent reviews leave it untouched.
    if (!card.introducedAt) set['introducedAt'] = now;

    await SrsRecord.updateOne({ _id: card._id }, { $set: set }).exec();

    return { dueDate: newDueDate };
  }

  /** Which dictionary line a back-less card shows. Study state, so it is NOT
   * gated by the list lock. */
  async getLemmaIndex(userId: string, term: string, lang: string, listId: string): Promise<number> {
    const card = await SrsRecord.findOne({
      userId: new Types.ObjectId(userId),
      listId: new Types.ObjectId(listId),
      term,
      lang,
    })
      .select('lemmaIndex')
      .lean()
      .exec();
    return card?.lemmaIndex ?? 0;
  }

  async setLemmaIndex(userId: string, term: string, lang: string, listId: string, lemmaIndex: number): Promise<void> {
    await SrsRecord.updateOne(
      { userId: new Types.ObjectId(userId), listId: new Types.ObjectId(listId), term, lang },
      { $set: { lemmaIndex } },
    ).exec();
  }
}

export interface StudyCard {
  reps: number;
  dueDate: Date;
  introducedAt: Date | null;
  /** List display position; higher sorts earlier (newest savedAt = top of list). */
  order: number;
}

/**
 * Build a study session's card queue under the daily new-card cap (Anki's
 * `newToday` model). Pure so it can be unit-tested without a database.
 *
 * Only never-introduced cards (`introducedAt == null`) consume the daily budget,
 * so the cap survives cancel/restart within a day: a card introduced earlier
 * today (even one failed back to reps 0) is already counted and is re-served
 * without re-charging the budget. Order: due reviews, then due in-progress new,
 * then up to `budget` fresh new cards in list order.
 */
export function selectStudyQueue<T extends StudyCard>(cards: T[], cap: number, now: Date): T[] {
  const dayStart = startOfDay(now);
  const introducedToday = cards.filter((c) => c.introducedAt !== null && c.introducedAt >= dayStart).length;
  const budget = Math.max(0, cap - introducedToday);

  const dueExisting = cards
    .filter((c) => c.introducedAt !== null && c.dueDate <= now)
    // Reviews (reps > 0) ahead of in-progress/lapsed new cards (reps === 0).
    .sort((a, b) => (b.reps > 0 ? 1 : 0) - (a.reps > 0 ? 1 : 0));

  const freshNew = cards
    .filter((c) => c.introducedAt === null)
    .sort((a, b) => b.order - a.order)
    .slice(0, budget);

  return [...dueExisting, ...freshNew];
}

export function startOfDay(now: Date): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
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
  card: { term: string; lang: string; listId: unknown; interval: number; easeFactor: number; dueDate: unknown; reps: number; lapses: number; lemmaIndex: number },
  back: string | undefined,
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
    lemmaIndex: card.lemmaIndex,
  };
  if (back !== undefined) info.back = back;
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
