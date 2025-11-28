import { InferSchemaType, model, Schema, Types } from 'mongoose';

const LemmaSchema = new Schema(
  {
    text: { type: String, required: true },
    word: { type: String, required: true },
    lang: { type: String, required: true },
    keyword: { type: Boolean, required: true },
    baseWord: { type: String, required: true },
    baseLang: { type: String, required: true },
    order: { type: Number, required: true },
    homonym: { type: Number, required: true },
    groupName: { type: String, required: true },
    _topic: { type: Schema.Types.ObjectId, required: true, ref: 'Topic' },
  },
  { collation: { locale: 'nl', strength: 1 } },
);

export type LemmaDoc = InferSchemaType<typeof LemmaSchema> & {
  _id?: Types.ObjectId;
};

LemmaSchema.index({ word: 1, lang: 1, order: 1 });

const Lemma = model('Lemma', LemmaSchema);
export default Lemma;
