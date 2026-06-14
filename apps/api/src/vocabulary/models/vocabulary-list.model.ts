import { InferSchemaType, model, Schema, Types } from 'mongoose';

const VocabularyListSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
  name: { type: String, required: true },
  isPublic: { type: Boolean, default: false },
  // A locked list is immutable: its items cannot be added, removed or edited
  // (its SRS review state is unaffected). Cloned lists start locked, since the
  // intent is to study them as-is; the owner can unlock to edit.
  isLocked: { type: Boolean, default: false },
  // Set when this list was cloned from a public list. Recorded for a future
  // "re-sync from source" feature; nothing reads it yet.
  clonedFrom: { type: Schema.Types.ObjectId, ref: 'VocabularyList', default: null },
  createdAt: { type: Date, default: Date.now },
});

VocabularyListSchema.index({ userId: 1, name: 1 }, { unique: true });

export type VocabularyListDoc = InferSchemaType<typeof VocabularyListSchema> & {
  _id: Types.ObjectId;
};

const VocabularyList = model('VocabularyList', VocabularyListSchema);
export default VocabularyList;
