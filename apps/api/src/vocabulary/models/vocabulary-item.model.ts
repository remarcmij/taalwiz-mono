import { InferSchemaType, model, Schema, Types } from 'mongoose';

const VocabularyItemSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
  listId: { type: Schema.Types.ObjectId, required: true, ref: 'VocabularyList' },
  term: { type: String, required: true },
  lang: { type: String, required: true },
  back: { type: String },
  sourceSentence: { type: String },
  savedAt: { type: Date, default: Date.now },
});

VocabularyItemSchema.index({ userId: 1, listId: 1, term: 1, lang: 1 }, { unique: true });

export type VocabularyItemDoc = InferSchemaType<typeof VocabularyItemSchema> & {
  _id?: Types.ObjectId;
};

const VocabularyItem = model('VocabularyItem', VocabularyItemSchema);
export default VocabularyItem;
