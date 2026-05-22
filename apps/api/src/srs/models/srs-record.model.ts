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
});

SrsRecordSchema.index({ userId: 1, listId: 1, term: 1, lang: 1 }, { unique: true });

export type SrsRecordDoc = InferSchemaType<typeof SrsRecordSchema> & {
  _id: Types.ObjectId;
};

const SrsRecord = model('SrsRecord', SrsRecordSchema);
export default SrsRecord;
