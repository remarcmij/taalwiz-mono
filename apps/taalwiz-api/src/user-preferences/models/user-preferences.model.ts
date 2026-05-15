import { InferSchemaType, model, Schema, Types } from 'mongoose';

const UserPreferencesSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, required: true, unique: true, ref: 'User' },
  currentBookmarkListId: { type: Schema.Types.ObjectId, ref: 'BookmarkList', default: null },
});

export type UserPreferencesDoc = InferSchemaType<typeof UserPreferencesSchema> & {
  _id?: Types.ObjectId;
};

const UserPreferences = model('UserPreferences', UserPreferencesSchema);
export default UserPreferences;
