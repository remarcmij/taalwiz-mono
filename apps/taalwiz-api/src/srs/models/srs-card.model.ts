import { InferSchemaType, model, Schema, Types } from 'mongoose';

const SrsCardSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
  listId: { type: Schema.Types.ObjectId, required: true, ref: 'BookmarkList' },
  word: { type: String, required: true },
  lang: { type: String, required: true },
  interval: { type: Number, required: true, default: 1 },
  easeFactor: { type: Number, required: true, default: 2.5 },
  dueDate: { type: Date, required: true, default: Date.now },
  reps: { type: Number, required: true, default: 0 },
  lapses: { type: Number, required: true, default: 0 },
});

SrsCardSchema.index({ userId: 1, listId: 1, word: 1, lang: 1 }, { unique: true });

export type SrsCardDoc = InferSchemaType<typeof SrsCardSchema> & {
  _id: Types.ObjectId;
};

const SrsCard = model('SrsCard', SrsCardSchema);
export default SrsCard;
