import { InferSchemaType, model, Schema, Types } from 'mongoose';

const VocabularyListSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
  name: { type: String, required: true },
  isPublic: { type: Boolean, default: false },
  // A locked list rejects interactive, per-word edits — bookmarking or
  // un-bookmarking a single word from the word-click dialog or the list view.
  // Deliberate bulk import is still allowed (it is how a list grows), and SRS
  // review state is unaffected. A freshly imported list starts locked, since the
  // intent is to study it as-is; the owner can unlock to hand-edit.
  isLocked: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

VocabularyListSchema.index({ userId: 1, name: 1 }, { unique: true });

export type VocabularyListDoc = InferSchemaType<typeof VocabularyListSchema> & {
  _id: Types.ObjectId;
};

const VocabularyList = model('VocabularyList', VocabularyListSchema);
export default VocabularyList;
