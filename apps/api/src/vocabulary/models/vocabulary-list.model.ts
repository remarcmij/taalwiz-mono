import { InferSchemaType, model, Schema, Types } from 'mongoose';

const VocabularyListSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
  name: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

VocabularyListSchema.index({ userId: 1, name: 1 }, { unique: true });

export type VocabularyListDoc = InferSchemaType<typeof VocabularyListSchema> & {
  _id: Types.ObjectId;
};

const VocabularyList = model('VocabularyList', VocabularyListSchema);
export default VocabularyList;
