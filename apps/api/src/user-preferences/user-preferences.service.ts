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

  async patch(userId: string, currentVocabularyListId: string | undefined): Promise<void> {
    await UserPreferences.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      { $set: { currentVocabularyListId: currentVocabularyListId ? new Types.ObjectId(currentVocabularyListId) : null } },
      { upsert: true },
    ).exec();
  }
}
