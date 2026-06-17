import { InferSchemaType, model, Schema, Types } from 'mongoose';

const SrsRecordSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
  listId: { type: Schema.Types.ObjectId, required: true, ref: 'VocabularyList' },
  term: { type: String, required: true },
  lang: { type: String, required: true },
  interval: { type: Number, required: true, default: 1 },
  easeFactor: { type: Number, required: true, default: 2.5 },
  dueDate: { type: Date, required: true, default: Date.now },
  reps: { type: Number, required: true, default: 0 },
  lapses: { type: Number, required: true, default: 0 },
  // When the card was first reviewed (graduated out of "never seen"). Null until
  // then. This, not `reps`, marks "already introduced" because an "Again" review
  // resets reps to 0 — so a failed-today new card still reads as introduced.
  introducedAt: { type: Date, default: null },
});

SrsRecordSchema.index({ userId: 1, listId: 1, term: 1, lang: 1 }, { unique: true });
// Supports the per-list "how many new cards introduced today" count.
SrsRecordSchema.index({ userId: 1, listId: 1, introducedAt: 1 });

export type SrsRecordDoc = InferSchemaType<typeof SrsRecordSchema> & {
  _id: Types.ObjectId;
};

const SrsRecord = model('SrsRecord', SrsRecordSchema);
export default SrsRecord;
