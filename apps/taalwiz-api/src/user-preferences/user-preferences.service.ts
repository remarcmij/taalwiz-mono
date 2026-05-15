import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import UserPreferences from './models/user-preferences.model.js';

export interface UserPreferencesData {
  currentBookmarkListId: string | null;
}

@Injectable()
export class UserPreferencesService {
  async get(userId: string): Promise<UserPreferencesData> {
    const prefs = await UserPreferences.findOne({ userId: new Types.ObjectId(userId) }).exec();
    return {
      currentBookmarkListId: prefs?.currentBookmarkListId?.toString() ?? null,
    };
  }

  async patch(userId: string, currentBookmarkListId: string | undefined): Promise<void> {
    await UserPreferences.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      { $set: { currentBookmarkListId: currentBookmarkListId ? new Types.ObjectId(currentBookmarkListId) : null } },
      { upsert: true },
    ).exec();
  }
}
