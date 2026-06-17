import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import UserPreferences from './models/user-preferences.model.js';

export interface UserPreferencesData {
  currentVocabularyListId: string | null;
  newCardsPerDay: number;
}

export const DEFAULT_NEW_CARDS_PER_DAY = 20;

@Injectable()
export class UserPreferencesService {
  async get(userId: string): Promise<UserPreferencesData> {
    const prefs = await UserPreferences.findOne({ userId: new Types.ObjectId(userId) }).exec();
    return {
      currentVocabularyListId: prefs?.currentVocabularyListId?.toString() ?? null,
      newCardsPerDay: prefs?.newCardsPerDay ?? DEFAULT_NEW_CARDS_PER_DAY,
    };
  }

  // Sets only the fields actually present in `changes`, so callers updating one
  // preference (e.g. the cap) never clobber another (e.g. the current list).
  async patch(
    userId: string,
    changes: { currentVocabularyListId?: string; newCardsPerDay?: number },
  ): Promise<void> {
    const set: Record<string, unknown> = {};
    if (changes.currentVocabularyListId !== undefined) {
      set['currentVocabularyListId'] = changes.currentVocabularyListId
        ? new Types.ObjectId(changes.currentVocabularyListId)
        : null;
    }
    if (changes.newCardsPerDay !== undefined) {
      set['newCardsPerDay'] = changes.newCardsPerDay;
    }
    if (Object.keys(set).length === 0) return;

    await UserPreferences.findOneAndUpdate({ userId: new Types.ObjectId(userId) }, { $set: set }, { upsert: true }).exec();
  }
}
