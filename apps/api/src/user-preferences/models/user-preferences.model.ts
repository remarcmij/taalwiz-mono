import { InferSchemaType, model, Schema, Types } from 'mongoose';

const UserPreferencesSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, required: true, unique: true, ref: 'User' },
  currentVocabularyListId: { type: Schema.Types.ObjectId, ref: 'VocabularyList', default: null },
  // Max new (never-reviewed) SRS cards introduced per day, per the deck-chunking
  // model. Editing is not yet exposed in the UI (see plan); default applies.
  newCardsPerDay: { type: Number, default: 20, min: 1, max: 100 },
});

export type UserPreferencesDoc = InferSchemaType<typeof UserPreferencesSchema> & {
  _id?: Types.ObjectId;
};

const UserPreferences = model('UserPreferences', UserPreferencesSchema);
export default UserPreferences;
